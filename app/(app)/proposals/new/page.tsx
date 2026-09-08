import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { requireUser } from '@/lib/auth'
import { isAIEnabled } from '@/lib/env'
import { createServerClient } from '@/lib/supabase/server'

import { NewProposalForm } from './new-proposal-form'

export const metadata: Metadata = { title: 'Nueva propuesta · doscientos' }
export const dynamic = 'force-dynamic'

/**
 * Lead-first proposal creation: the recipient is either an existing client
 * or an open lead. An optional project can be linked when the proposal
 * extends ongoing work for a known client.
 */
export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; lead_id?: string }>
}) {
  await requireUser()
  const { client_id, lead_id } = await searchParams

  const supabase = await createServerClient()
  const [{ data: clients }, { data: leads }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
    supabase
      .from('leads')
      .select('id, name, company, status')
      .is('deleted_at', null)
      .not('status', 'in', '(won,lost,not_interested,archived)')
      .order('name'),
    supabase.from('projects').select('id, name, client_id').is('deleted_at', null).order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva propuesta"
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
      />
      <NewProposalForm
        clients={(clients ?? []) as Array<{ id: string; name: string }>}
        leads={
          (leads ?? []) as Array<{
            id: string
            name: string
            company: string | null
            status: string
          }>
        }
        projects={(projects ?? []) as Array<{ id: string; name: string; client_id: string }>}
        initialClientId={client_id}
        initialLeadId={lead_id}
        aiEnabled={isAIEnabled()}
      />
    </div>
  )
}
