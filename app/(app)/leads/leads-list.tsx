'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'
import { MemberLabel } from '@/components/ui/member-avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { requiresCyaProspectSoftwareCommission } from '@/lib/leads/attribution'
import type { LeadListItem } from '@/lib/leads/types'
import { getLeadInitials, leadDisplayName } from '@/lib/leads/utils'
import type { MemberOption } from '@/lib/members/queries'
import { LEAD_STATUS } from '@/lib/status'
import { relativeTime } from '@/lib/utils'

import { LeadFastActions } from './lead-fast-actions'
import { LeadQuickView } from './lead-quick-view'
import type { KanbanLead } from './leads-kanban'

type LeadsListProps = Omit<ListPageProps, 'rows'> & {
  leads: LeadListItem[]
  aiEnabled?: boolean
  canEdit?: boolean
  members?: MemberOption[]
  senderName?: string
}

function LeadInitials({ lead }: { lead: KanbanLead }) {
  return (
    <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase">
      {getLeadInitials(lead)}
    </span>
  )
}

export function LeadsList({
  leads,
  aiEnabled = false,
  canEdit = false,
  members = [],
  senderName = '',
  ...props
}: LeadsListProps) {
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)

  const rows = leads.map((l) => ({
    id: l.id,
    data: l as KanbanLead,
    csvValues: [
      leadDisplayName(l),
      l.company ?? '',
      l.email ?? '',
      l.status,
      l.assignee?.name ?? '',
      l.created_at,
      l.company_size ?? '',
      l.solution_type ?? '',
      l.urgency ?? '',
      l.source ?? '',
      l.marketing_campaign_name ?? '',
      l.score?.toString() ?? '',
    ],
    cells: [
      <Link
        key="name"
        href={`/leads/${l.id}`}
        className="group/leadname inline-flex items-center gap-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <LeadInitials lead={l} />
        <span className="group-hover/leadname:text-primary max-w-40 truncate font-medium underline-offset-2 transition-colors group-hover/leadname:underline">
          {leadDisplayName(l)}
        </span>
        <ArrowRight className="size-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/leadname:translate-x-0 group-hover/leadname:opacity-60" />
      </Link>,
      l.company,
      l.email ? (
        <a
          key="email"
          href={`mailto:${l.email}`}
          className="hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {l.email}
        </a>
      ) : null,
      <div key="campaign" className="flex min-w-32 flex-col gap-0.5">
        <span className="truncate" title={l.marketing_campaign_name ?? undefined}>
          {l.marketing_campaign_name ?? '—'}
        </span>
        {requiresCyaProspectSoftwareCommission(l.marketing_campaign_name) && (
          <span className="text-warning text-[11px] font-medium">Comisión CYA · 20 %</span>
        )}
      </div>,
      <div key="status" className="flex flex-col gap-0.5">
        <StatusBadge meta={LEAD_STATUS} value={l.status} />
        {(l.status === 'lost' || l.status === 'not_interested') && l.lost_reason && (
          <span className="text-destructive/80 max-w-36 truncate text-[11px]">{l.lost_reason}</span>
        )}
      </div>,
      <span key="score" className="text-muted-foreground tabular-nums">
        {l.score ?? '—'}
      </span>,
      <MemberLabel key="assignee" member={l.assignee} size="sm" />,
      <span key="created" className="tabular-nums">
        {relativeTime(l.created_at)}
      </span>,
      // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation to the parent row; contains own interactive controls
      <div key="actions" className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <LeadFastActions lead={l} aiEnabled={aiEnabled} senderName={senderName} />
      </div>,
    ],
  }))

  return (
    <>
      <ListPage
        {...props}
        rows={rows}
        onRowClick={(row) => setSelectedLead(row.data as KanbanLead)}
      />
      <LeadQuickView
        lead={selectedLead}
        canEdit={canEdit}
        aiEnabled={aiEnabled}
        members={members}
        senderName={senderName}
        onCloseAction={() => setSelectedLead(null)}
      />
    </>
  )
}
