'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

type ActionResult = { ok: true } | { ok: false; error: string }

const GoalsInput = z.object({
  leadsNew: z.coerce.number().positive().nullable(),
  revenue: z.coerce.number().positive().nullable(),
  conversionRate: z.coerce.number().min(1).max(100).nullable(),
})

export async function upsertCompanyGoals(input: unknown): Promise<ActionResult> {
  await requireRole(['owner', 'admin'])

  const parsed = GoalsInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  }

  const { leadsNew, revenue, conversionRate } = parsed.data

  const rows: { metric: string; target: number }[] = []
  if (leadsNew) rows.push({ metric: 'leads_new', target: leadsNew })
  if (revenue) rows.push({ metric: 'revenue', target: revenue })
  // UI sends %; DB stores fraction 0..1
  if (conversionRate) rows.push({ metric: 'conversion_rate', target: conversionRate / 100 })

  const supabase = await createServerClient()

  // Delete metrics that were cleared (set to 0 / null)
  const clearedMetrics: string[] = []
  if (!leadsNew) clearedMetrics.push('leads_new')
  if (!revenue) clearedMetrics.push('revenue')
  if (!conversionRate) clearedMetrics.push('conversion_rate')

  if (clearedMetrics.length > 0) {
    const { error } = await supabase.from('company_goals').delete().in('metric', clearedMetrics)
    if (error) return { ok: false, error: error.message }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('company_goals').upsert(rows, { onConflict: 'metric' })
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/inicio')
  revalidatePath('/settings/goals')
  return { ok: true }
}
