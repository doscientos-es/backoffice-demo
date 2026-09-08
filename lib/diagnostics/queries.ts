import { createAdminClient } from '@/lib/supabase/admin'

export type LeadDiagnostic = {
  id: string
  email: string
  company: string | null
  answers: Record<string, unknown>
  metrics: {
    yearlyHours?: number
    yearlyCost?: number
    monthlyHours?: number
    risk?: string
    primaryOpportunity?: string
  }
  status: string
  report_sent_at: string | null
  report_opened_at: string | null
  created_at: string
}

export async function listLeadDiagnostics(leadId: string): Promise<LeadDiagnostic[]> {
  const { data, error } = await createAdminClient()
    .from('diagnostics')
    .select(
      'id, email, company, answers, metrics, status, report_sent_at, report_opened_at, created_at',
    )
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) return []
  return (data ?? []) as LeadDiagnostic[]
}
