import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export const EXPORTABLE_TABLES = [
  'settings',
  'team_members',
  'leads',
  'lead_interactions',
  'clients',
  'projects',
  'project_checklist_items',
  'milestones',
  'work_logs',
  'time_entries',
  'tasks',
  'task_members',
  'task_comments',
  'task_tags',
  'task_tag_assignments',
  'proposals',
  'proposal_items',
  'proposal_messages',
  'proposal_specs',
  'proposal_team_members',
  'proposal_views',
  'proposal_view_events',
  'invoices',
  'invoice_items',
  'invoice_payments',
  'expenses',
  'subscriptions',
  'attachments',
  'documents',
  'internal_documents',
  'internal_document_events',
  'internal_document_extractions',
  'internal_document_text_pages',
  'email_templates',
  'lead_campaigns',
  'lead_campaign_sends',
  'marketing_campaigns',
  'marketing_ad_sets',
  'marketing_ads',
  'marketing_insights',
  'brand_guides',
  'brand_tokens',
  'brand_assets',
  'company_goals',
  'web_projects',
  'notifications',
  'notification_preferences',
  'onboarding_templates',
  'onboarding_template_items',
  'social_posts',
  'social_post_targets',
  'social_post_insights',
  'social_comments',
  'social_automation_rules',
  'social_automation_runs',
  'social_automation_events',
  'diagnostics',
  'conversion_events',
  'verifactu_ledger',
  'verifactu_outbox',
] as const

export type ExportableTable = (typeof EXPORTABLE_TABLES)[number]
export type ExportRecord = Record<string, unknown>

const PAGE_SIZE = 1_000
const SENSITIVE_KEY =
  /(?:pass(?:word|phrase)?|secret|token|api[_-]?key|private[_-]?key|credential)/i

export function isExportableTable(value: string | null): value is ExportableTable {
  return Boolean(value && EXPORTABLE_TABLES.includes(value as ExportableTable))
}

export function sanitizeExportRecord(record: ExportRecord): ExportRecord {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !SENSITIVE_KEY.test(key)))
}

export function dataToCsv(rows: ExportRecord[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escapeCsv = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
  ]
    .join('\r\n')
    .concat('\r\n')
}

async function readTable(table: ExportableTable): Promise<ExportRecord[]> {
  const admin = createAdminClient()
  const rows: ExportRecord[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`No se pudo exportar ${table}: ${error.message}`)
    const page = (data ?? []) as ExportRecord[]
    rows.push(...page.map(sanitizeExportRecord))
    if (page.length < PAGE_SIZE) return rows
  }
}

export async function exportTable(table: ExportableTable): Promise<ExportRecord[]> {
  return readTable(table)
}

export async function exportAllOperationalData() {
  const tables: Record<string, ExportRecord[]> = {}
  for (const table of EXPORTABLE_TABLES) tables[table] = await readTable(table)
  return { version: 1, generatedAt: new Date().toISOString(), tables }
}
