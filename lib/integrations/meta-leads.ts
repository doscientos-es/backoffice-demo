import { createHmac, timingSafeEqual } from 'node:crypto'

import { serverEnv } from '@/lib/env'
import {
  classifyFormAnswers,
  type FormAnswer,
  type LeadIntake,
  parseBudgetFloor,
} from '@/lib/integrations/lead-intake'
import { scopedLogger } from '@/lib/logger'

const log = scopedLogger('meta-leads')

export const META_LEAD_SOURCE = 'Anuncios Meta'

/**
 * Meta sends a JSON body and signs it with HMAC-SHA256 using the App Secret.
 * Header format: `X-Hub-Signature-256: sha256=<hex>`.
 * Doc: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 */
export function verifyMetaSignature(
  appSecret: string,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature || !appSecret) return false
  const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(provided, 'hex')
  if (a.length === 0 || a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ---------------- Graph API types ----------------

export type MetaLeadgenChange = {
  value: {
    leadgen_id: string
    page_id: string
    form_id: string
    ad_id?: string
    adgroup_id?: string
    created_time?: number
  }
  field: 'leadgen'
}

export type MetaWebhookPayload = {
  object: 'page'
  entry: Array<{
    id: string
    time: number
    changes: MetaLeadgenChange[]
  }>
}

export type MetaLeadField = { name: string; values: string[] }

export type MetaLeadgenResponse = {
  id: string
  created_time: string
  field_data: MetaLeadField[]
  ad_id?: string
  adset_id?: string
  campaign_id?: string
  form_id?: string
  platform?: string
  is_organic?: boolean
}

/**
 * Fetch full lead data from the Graph API using the page access token.
 * Field names are localized to the form's language, so we read by common keys
 * AND fall back to fuzzy matching in mapMetaLeadgenToIntake().
 */
export async function fetchMetaLeadgen(leadgenId: string): Promise<MetaLeadgenResponse> {
  const env = serverEnv()
  if (!env.META_PAGE_ACCESS_TOKEN) {
    throw new Error('META_PAGE_ACCESS_TOKEN not configured')
  }
  const url = new URL(
    `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${encodeURIComponent(leadgenId)}`,
  )
  url.searchParams.set(
    'fields',
    'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id,platform,is_organic',
  )
  url.searchParams.set('access_token', env.META_PAGE_ACCESS_TOKEN)

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as MetaLeadgenResponse
}

// ---------------- Field mapping ----------------

const FIELD_ALIASES = {
  email: ['email', 'correo_electronico', 'correo', 'e-mail'],
  phone: ['phone_number', 'phone', 'telefono', 'teléfono', 'tel'],
  fullName: ['full_name', 'nombre_completo', 'name', 'nombre'],
  firstName: ['first_name', 'nombre'],
  lastName: ['last_name', 'apellidos', 'apellido'],
  company: ['company_name', 'empresa', 'company', 'organizacion'],
  urgency: ['urgency', 'urgencia', 'cuando_necesitas_empezar', 'plazo', 'priority'],
} as const

/**
 * Standard contact fields Meta prefills from the user's profile. They are
 * captured separately (name/email/phone/company), so they must never leak into
 * the qualifying-answer extraction — otherwise they'd pollute `notes` or be
 * misread by the keyword classifier.
 */
const CONTACT_FIELD_KEYS: ReadonlySet<string> = new Set([
  ...FIELD_ALIASES.email,
  ...FIELD_ALIASES.phone,
  ...FIELD_ALIASES.fullName,
  ...FIELD_ALIASES.firstName,
  ...FIELD_ALIASES.lastName,
  ...FIELD_ALIASES.company,
])

function findField(fields: MetaLeadField[], candidates: ReadonlyArray<string>): string | null {
  const normalized = fields.map((f) => ({
    key: f.name.toLowerCase().trim(),
    value: f.values?.[0] ?? null,
  }))
  for (const c of candidates) {
    const hit = normalized.find((n) => n.key === c)
    if (hit?.value) return hit.value
  }
  return null
}

/**
 * Converts a snake_case field key or value to a human-readable string.
 * Only modifies strings that contain underscores; already-clean values
 * (e.g. "Sí", "Lo antes posible") are returned unchanged.
 * Examples:
 *   "tamaño_de_empresa"  → "Tamaño de empresa"
 *   "lo_antes_posible"   → "Lo antes posible"
 *   "10-50_empleados"    → "10-50 empleados"
 *   "Sí"                 → "Sí" (unchanged)
 */
function prettifySnakeCase(text: string): string {
  if (!text.includes('_')) return text
  const spaced = text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function isCompanySizeLabel(label: string): boolean {
  const key = normalize(label)
  return key.includes('tamano') || key.includes('empleado')
}

function isUrgencyLabel(label: string): boolean {
  const key = normalize(label)
  return (
    key.includes('cuando') ||
    key.includes('plazo') ||
    key.includes('urgen') ||
    key.includes('empezar') ||
    key.includes('inicio') ||
    key.includes('solucionar') ||
    key.includes('urgencia')
  )
}

function isSolutionTypeLabel(label: string): boolean {
  const key = normalize(label)
  return key.includes('solucion') || key.includes('necesitas') || key.includes('proyecto')
}

function isBudgetLabel(label: string): boolean {
  return normalize(label).includes('presupuesto')
}

function isUrgencyLikeValue(value: string): boolean {
  const v = normalize(value)
  return (
    v.includes('lo antes posible') ||
    v.includes('cuanto antes') ||
    v.includes('inmediat') ||
    v.includes('urgent') ||
    v.includes('este mes') ||
    v.includes('trimestre') ||
    v.includes('sin prisa') ||
    v.includes('explor') ||
    v.includes('solo informacion')
  )
}

/**
 * Extracts custom form questions from Meta field_data as label/value pairs.
 * Any field that isn't a standard contact field counts as a qualifying answer,
 * regardless of whether Meta sends the raw Spanish question ("¿…?") or a
 * snake_case field ID. Labels and values in snake_case are prettified so that
 * both the notes block and the stored qualification columns are human-readable.
 */
function extractMetaFormAnswers(fields: MetaLeadField[]): FormAnswer[] {
  const answers: FormAnswer[] = []
  for (const field of fields) {
    const key = field.name.trim()
    if (CONTACT_FIELD_KEYS.has(key.toLowerCase())) continue
    const rawValue = field.values?.[0]?.trim()
    if (!rawValue) continue
    const label = key.startsWith('¿')
      ? key
          .replace(/^¿/, '')
          .replace(/\?\s*$/, '')
          .trim()
      : prettifySnakeCase(key)
    const value = prettifySnakeCase(rawValue)
    answers.push({ label, value })
  }
  return answers
}

/** Renders extracted answers into the human-readable `notes` block. */
function formAnswersToNotes(
  answers: FormAnswer[],
  structured: {
    companySize: string | null
    solutionType: string | null
    urgency: string | null
    estimatedValue: number | null
  },
): string | null {
  const remaining = answers.filter((answer) => {
    if (
      structured.companySize &&
      answer.value === structured.companySize &&
      isCompanySizeLabel(answer.label)
    ) {
      return false
    }
    if (
      structured.solutionType &&
      answer.value === structured.solutionType &&
      isSolutionTypeLabel(answer.label)
    ) {
      return false
    }
    if (structured.urgency && answer.value === structured.urgency && isUrgencyLabel(answer.label)) {
      return false
    }
    if (structured.estimatedValue !== null && isBudgetLabel(answer.label)) {
      return false
    }
    return true
  })

  return remaining.length > 0 ? remaining.map((a) => `${a.label}: ${a.value}`).join('\n') : null
}

/**
 * Locates the "presupuesto" answer among the Meta field_data and delegates the
 * numeric parsing to the shared parseBudgetFloor() helper.
 */
function parseMetaBudgetToEstimatedValue(fields: MetaLeadField[]): number | null {
  for (const field of fields) {
    if (!field.name.toLowerCase().includes('presupuesto')) continue
    const parsed = parseBudgetFloor(field.values?.[0])
    if (parsed !== null) return parsed
  }
  return null
}

/** Converts a Graph API leadgen response into our generic LeadIntake shape. */
export function mapMetaLeadgenToIntake(
  res: MetaLeadgenResponse,
  webhookCtx?: { pageId?: string; createdTime?: number },
): LeadIntake {
  const fullName =
    findField(res.field_data, FIELD_ALIASES.fullName) ||
    [
      findField(res.field_data, FIELD_ALIASES.firstName),
      findField(res.field_data, FIELD_ALIASES.lastName),
    ]
      .filter(Boolean)
      .join(' ') ||
    'Lead sin nombre'

  const formAnswers = extractMetaFormAnswers(res.field_data)
  const qualification = classifyFormAnswers(formAnswers)
  const explicitUrgency = findField(res.field_data, FIELD_ALIASES.urgency)
  const estimatedValue = parseMetaBudgetToEstimatedValue(res.field_data)
  const inferredUrgencyFromValue =
    formAnswers.find((a) => isUrgencyLikeValue(a.value))?.value ?? null
  const urgency = explicitUrgency || qualification.urgency || inferredUrgencyFromValue

  return {
    name: fullName,
    email: findField(res.field_data, FIELD_ALIASES.email),
    phone: findField(res.field_data, FIELD_ALIASES.phone),
    company: findField(res.field_data, FIELD_ALIASES.company),
    notes: formAnswersToNotes(formAnswers, {
      companySize: qualification.companySize,
      solutionType: qualification.solutionType,
      urgency,
      estimatedValue,
    }),
    estimatedValue,
    companySize: qualification.companySize,
    solutionType: qualification.solutionType,
    urgency,
    source: META_LEAD_SOURCE,
    externalId: res.id,
    externalSource: META_LEAD_SOURCE,
    utm: {
      source: 'facebook',
      medium: 'paid_social',
      campaign: res.campaign_id ?? null,
      content: res.ad_id ?? null,
      term: res.adset_id ?? null,
    },
    context: { referrer: res.platform ?? 'facebook' },
    rawPayload: { ...res, webhookCtx: webhookCtx ?? null },
  }
}

export function logMetaError(msg: string, extra?: Record<string, unknown>): void {
  log.error(extra ?? {}, msg)
}
