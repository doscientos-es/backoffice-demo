import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

/** Leads that already have a future call or meeting do not need a stale-lead alert. */
export async function findLeadIdsWithScheduledContact(
  supabase: AdminClient,
  leadIds: string[],
  now = new Date(),
): Promise<Set<string>> {
  const uniqueLeadIds = [...new Set(leadIds)]
  if (uniqueLeadIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('tasks')
    .select('lead_id')
    .eq('kind', 'reminder')
    .in('lead_id', uniqueLeadIds)
    .in('action_type', ['call', 'meeting'])
    .gte('start_at', now.toISOString())
    .is('completed_at', null)
    .is('deleted_at', null)
    .limit(uniqueLeadIds.length)
  if (error) throw new Error(error.message)

  return new Set((data ?? []).flatMap((task) => (task.lead_id ? [task.lead_id] : [])))
}
