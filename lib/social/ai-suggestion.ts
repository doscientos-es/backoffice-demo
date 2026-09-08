import { z } from 'zod'

/** Structured briefing returned by the social post assistant. */
export const SocialPostSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  angle: z.string().trim().min(1).max(500),
  audience: z.string().trim().min(1).max(300),
  rationale: z.string().trim().min(1).max(800),
  visualConcept: z.string().trim().min(1).max(1200),
  layout: z.string().trim().min(1).max(1600),
  photoBrief: z.string().trim().min(1).max(1000),
  // Leave room for the generated hashtags when the form applies the suggestion.
  caption: z.string().trim().min(1).max(2400),
  callToAction: z.string().trim().min(1).max(300),
  hashtags: z.array(z.string().trim().min(1).max(60)).max(12),
})

export type SocialPostSuggestion = z.infer<typeof SocialPostSuggestionSchema>

export type SocialCompanyContext = {
  name: string
  positioning: string
}

/** Ensures model-generated tags are ready to render and publish. */
export function normalizeHashtags(hashtags: string[]): string[] {
  const seen = new Set<string>()
  return hashtags
    .map((hashtag) => hashtag.trim().replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .map((hashtag) => `#${hashtag}`)
    .filter((hashtag) => {
      const key = hashtag.toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 12)
}

export type SocialLeadContext = {
  status: string | null
  temperature: string | null
  score: number | null
  companySize: string | null
  solutionType: string | null
  urgency: string | null
  notes: string | null
  aiSummary: string | null
  aiTags: string[]
  momTest: {
    realProblem: boolean | null
    awareProblem: boolean | null
    triedSolutions: boolean | null
    decisionPowerOrBudget: boolean | null
    accessible: boolean | null
  }
}

export type SocialProjectContext = {
  name: string
  status: string | null
  description: string | null
}

export type SocialPainPointContext = {
  type: string
  subject: string | null
  body: string | null
}

export type SocialSuggestionContext = {
  company: SocialCompanyContext
  leads: SocialLeadContext[]
  projects: SocialProjectContext[]
  painPoints: SocialPainPointContext[]
}

/** Replaces common model placeholders so the returned copy is publishable. */
export function finalizeSocialSuggestion(
  suggestion: SocialPostSuggestion,
  companyName: string,
): SocialPostSuggestion {
  const replacePlaceholder = (value: string) =>
    value
      .replace(
        /\[\s*(?:nombre|name|tu|la)?\s*(?:de\s+la\s+)?(?:agencia|empresa)\s*\]/gi,
        () => companyName,
      )
      .replace(/\bnombre\s+de\s+la\s+agencia\b/gi, () => companyName)
      .replace(/\btu agencia\b/gi, () => companyName)

  return {
    ...suggestion,
    title: replacePlaceholder(suggestion.title),
    angle: replacePlaceholder(suggestion.angle),
    audience: replacePlaceholder(suggestion.audience),
    rationale: replacePlaceholder(suggestion.rationale),
    visualConcept: replacePlaceholder(suggestion.visualConcept),
    layout: replacePlaceholder(suggestion.layout),
    photoBrief: replacePlaceholder(suggestion.photoBrief),
    caption: replacePlaceholder(suggestion.caption),
    callToAction: replacePlaceholder(suggestion.callToAction),
  }
}

function text(value: unknown, fallback = '—'): string {
  if (value == null || String(value).trim() === '') return fallback
  return String(value).trim()
}

function clip(value: unknown, max: number): string {
  return text(value)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gi, '[email oculto]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[teléfono oculto]')
    .slice(0, max)
}

function yesNo(value: boolean | null): string {
  return value === true ? 'sí' : value === false ? 'no' : 'sin marcar'
}

/** Formats CRM context without exposing direct lead identifiers to the model. */
export function formatSocialContext(context: SocialSuggestionContext): string {
  const leads = context.leads.slice(0, 40).map((lead, index) => {
    const pain = [clip(lead.notes, 500), clip(lead.aiSummary, 500)]
      .filter((value) => value !== '—')
      .join(' | ')
    const momTest = [
      `problema real: ${yesNo(lead.momTest.realProblem)}`,
      `consciente: ${yesNo(lead.momTest.awareProblem)}`,
      `soluciones previas: ${yesNo(lead.momTest.triedSolutions)}`,
      `decisión/presupuesto: ${yesNo(lead.momTest.decisionPowerOrBudget)}`,
      `accesible: ${yesNo(lead.momTest.accessible)}`,
    ].join(', ')

    return [
      `${index + 1}. estado ${text(lead.status)}; temperatura ${text(lead.temperature)}; score ${text(lead.score)}`,
      `   necesidad: ${text(lead.solutionType)}; urgencia: ${text(lead.urgency)}; tamaño: ${text(lead.companySize)}`,
      `   pain points/señales: ${pain || '—'}; tags: ${lead.aiTags.join(', ') || '—'}`,
      `   Mom Test: ${momTest}`,
    ].join('\n')
  })

  const projects = context.projects
    .slice(0, 30)
    .map(
      (project, index) =>
        `${index + 1}. ${clip(project.name, 160)} | estado: ${text(project.status)} | ${clip(project.description, 700)}`,
    )

  const painPoints = context.painPoints.slice(0, 60).map((point, index) => {
    const subject = point.subject ? ` | ${clip(point.subject, 180)}` : ''
    return `${index + 1}. ${text(point.type)}${subject}: ${clip(point.body, 600)}`
  })

  return [
    `EMPRESA Y MARCA:\nNombre: ${context.company.name}\nPosicionamiento: ${context.company.positioning}`,
    'LEADS ACTUALES (datos agregados, sin nombres ni datos de contacto):',
    leads.join('\n') || '(ninguno)',
    '\nPROYECTOS REALIZADOS O ACTIVOS:',
    projects.join('\n') || '(ninguno)',
    '\nPAIN POINTS DETECTADOS EN INTERACCIONES:',
    painPoints.join('\n') || '(ninguno)',
  ].join('\n')
}

export function buildSocialSuggestionPrompt(
  directive: string | undefined,
  context: SocialSuggestionContext,
): string {
  return `Directriz opcional del equipo: ${directive?.trim() || '(sin directriz; encuentra la oportunidad más relevante)'}

Analiza el siguiente contexto interno y crea una propuesta accionable:

${formatSocialContext(context)}

No inventes casos, resultados, clientes ni cifras que no aparezcan en el contexto. Si falta información, formula una idea visual que se pueda ejecutar sin añadir afirmaciones no verificadas.
La descripción debe ser la versión final lista para publicar: no uses placeholders, corchetes, variables
ni fórmulas como "[Nombre de la Agencia]", "Nombre de la Agencia" o "tu agencia". Usa el nombre real
de la empresa proporcionado arriba cuando necesites mencionarla.`
}
