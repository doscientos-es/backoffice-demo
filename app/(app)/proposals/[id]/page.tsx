import {
  CircleCheck as CheckCircle2,
  Clock,
  FileText,
  Pencil,
  Presentation,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { PageHeader } from '@/components/layout/page-header'
import { PortalAccessControls } from '@/components/portal/portal-access-controls'
import {
  type ProposalMessage,
  ProposalMessageThread,
} from '@/components/proposals/proposal-message-thread'
import { AttachmentSection } from '@/components/ui/attachment-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopySummaryButton } from '@/components/ui/copy-summary-button'
import { SectionBoundary } from '@/components/ui/error-boundary'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireUser } from '@/lib/auth'
import { hasCompleteFiscalData } from '@/lib/crm/conversion'
import { isAIEnabled } from '@/lib/env'
import { parseKeyPoints, toEditableKeyPoints } from '@/lib/proposals/key-points'
import { parseMaintenanceOffer } from '@/lib/proposals/maintenance'
import {
  type PaymentSchedule,
  parsePaymentPlan,
  parseScopeModules,
  paymentPlanForSchedule,
  paymentScheduleInput,
} from '@/lib/proposals/scope'
import { PROPOSAL_STATUS, type ProposalStatus } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

import { updateProposalPortalAccess } from '../actions'
import { ProposalMoreActions } from './delete-proposal-button'
import { GenerateInvoiceButton } from './generate-invoice-button'
import { LinkProjectButton } from './link-project-button'
import { MarkAcceptedButton } from './mark-accepted-button'
import { replyToProposalMessage } from './message-actions'
import { type EditableItem, ProposalEditor } from './proposal-editor'
import { ProposalFollowUpAssistant } from './proposal-follow-up-assistant'
import { ProposalOverview } from './proposal-overview'
import { ProposalPaymentPlan } from './proposal-payment-plan'
import { type ProposalSpec, ProposalSpecs } from './proposal-specs'
import { ReopenProposalButton } from './reopen-proposal-button'
import { SendPreviewButton } from './send-preview-button'
import { ShareLinks } from './share-links'

type Surface = 'portal' | 'deck'

export const dynamic = 'force-dynamic'

export default async function ProposalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ai_draft?: string; mode?: string }>
}) {
  const { id } = await params
  const { ai_draft, mode } = await searchParams
  const user = await requireUser()
  const supabase = await createServerClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select(
      '*, clients(id, name, nif, billing_address_street, email, phone, contact_person), leads(id, name, company, email, phone), projects(id, name)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!proposal) notFound()

  const { data: items } = await supabase
    .from('proposal_items')
    .select('id, position, description, quantity, unit_price, vat_rate, subtotal, billing_cycle')
    .eq('proposal_id', id)
    .order('position')

  // Page-level opens (one row per visit). Slide-level rows are excluded.
  const { data: views } = await supabase
    .from('proposal_view_events')
    .select('id, viewer_type, viewed_at, surface, team_members(name)')
    .eq('proposal_id', id)
    .is('session_id', null)
    .order('viewed_at', { ascending: false })
    .limit(10)

  // Latest CLIENT open per surface — drives the check + date on each share row.
  // Team previews never set this; they show up in the history list below.
  const [{ data: lastPortalView }, { data: lastDeckView }] = await Promise.all([
    supabase
      .from('proposal_view_events')
      .select('viewed_at')
      .eq('proposal_id', id)
      .eq('viewer_type', 'client')
      .eq('surface', 'portal')
      .is('session_id', null)
      .order('viewed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('proposal_view_events')
      .select('viewed_at')
      .eq('proposal_id', id)
      .eq('viewer_type', 'client')
      .eq('surface', 'deck')
      .is('session_id', null)
      .order('viewed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const { data: specs } = await supabase
    .from('proposal_specs')
    .select('id, title, body_markdown, is_client_visible, portal_token, updated_at, version')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  const { data: attachments } = await supabase
    .from('attachments')
    .select('id, name, mime_type, size_bytes, created_at, source, drive_file_id, web_view_link')
    .eq('proposal_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  const { data: messages } = await supabase
    .from('proposal_messages')
    .select('id, author_type, author_name, body, created_at')
    .eq('proposal_id', id)
    .order('created_at', { ascending: true })

  // Projects available to link: same client or a client derived from this lead.
  // This mirrors the database rule which protects the association on every write.
  const clientId = (proposal.client_id as string | null) ?? null
  const leadId = (proposal.lead_id as string | null) ?? null
  const availableProjectsQuery = supabase
    .from('projects')
    .select('id, name, clients!inner(lead_id)')
    .is('deleted_at', null)
    .order('name')
  const { data: availableProjects } = clientId
    ? await availableProjectsQuery.eq('client_id', clientId)
    : leadId
      ? await availableProjectsQuery.eq('clients.lead_id', leadId)
      : { data: [] }

  const [{ data: teamMembers }, { data: proposalTeam }] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, name, job_title, avatar_url, github_handle')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('proposal_team_members')
      .select('member_id, position')
      .eq('proposal_id', id)
      .order('position'),
  ])

  // Deposit payments made from the proposal portal
  const { data: depositPayments } = await supabase
    .from('invoice_payments')
    .select('id, amount, status, confirmed_at, created_at, invoice_id')
    .eq('proposal_id', id)
    .order('created_at', { ascending: false })

  const { data: paymentPlanInvoices } = await supabase
    .from('invoices')
    .select('id, full_number, status, proposal_payment_plan_item_id')
    .eq('proposal_id', id)
    .is('deleted_at', null)
    .not('proposal_payment_plan_item_id', 'is', null)
    .order('created_at', { ascending: true })

  const client = (
    proposal as unknown as {
      clients: {
        id: string
        name: string
        nif: string | null
        billing_address_street: string | null
        email: string | null
        phone: string | null
        contact_person: string | null
      } | null
    }
  ).clients
  const lead = (
    proposal as unknown as {
      leads: {
        id: string
        name: string
        company: string | null
        email: string | null
        phone: string | null
      } | null
    }
  ).leads
  const project = (proposal as unknown as { projects: { id: string; name: string } | null })
    .projects
  const recipientEmail = client?.email ?? lead?.email ?? null

  const status = proposal.status as ProposalStatus
  const needsFiscal = !client || !hasCompleteFiscalData(client)
  const fiscalPrefill = client
    ? {
        name: client.name ?? '',
        nif: client.nif ?? '',
        billing_address: client.billing_address_street ?? '',
        contact_person: client.contact_person ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
      }
    : {
        name: lead?.company ?? lead?.name ?? '',
        nif: '',
        billing_address: '',
        contact_person: lead?.name ?? '',
        email: lead?.email ?? '',
        phone: lead?.phone ?? '',
      }
  const locked = status === 'accepted' || status === 'rejected'
  const editing = !locked && (mode === 'edit' || ai_draft === '1')
  const configuredPaymentPlan = parsePaymentPlan(proposal.payment_plan)
  const paymentSchedule = paymentScheduleInput.safeParse(proposal.payment_schedule)
  const paymentPlan =
    configuredPaymentPlan.length > 0
      ? configuredPaymentPlan
      : paymentSchedule.success
        ? paymentPlanForSchedule(paymentSchedule.data)
        : []
  // Drafts authored against a lead never receive a series number until the
  // first transition to `sent` (see `sendPreviewLink`). The header falls back
  // to a human label so the page never renders `null` in the title.
  const proposalNumber = (proposal.number as string | null) ?? 'Borrador'
  const recipientName = client?.name ?? lead?.name ?? 'Sin destinatario'

  const editableItems: EditableItem[] = ((items ?? []) as unknown as EditableItem[]).map((it) => ({
    id: it.id,
    description: it.description,
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    vat_rate: Number(it.vat_rate) || 0,
    billing_cycle: it.billing_cycle ?? 'none',
  }))

  const viewRows = (views ?? []) as unknown as Array<{
    id: string
    viewer_type: 'team' | 'client'
    viewed_at: string
    surface: Surface
    team_members: { name: string } | null
  }>

  const token = proposal.portal_token as string | null
  const portalViewedAt = (lastPortalView?.viewed_at as string | null) ?? null
  const deckViewedAt = (lastDeckView?.viewed_at as string | null) ?? null
  const selectedTeamIds = ((proposalTeam ?? []) as Array<{ member_id: string }>).map(
    (member) => member.member_id,
  )
  const visibleTeam = (
    (teamMembers ?? []) as Array<{
      id: string
      name: string
      job_title: string | null
    }>
  ).filter((member) => selectedTeamIds.includes(member.id))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={proposal.title as string}
        eyebrow={proposalNumber}
        titleClassName="text-pretty"
        description={recipientName}
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
        actions={
          <div className="flex items-center gap-1.5">
            <CopySummaryButton
              lines={(() => {
                const parts: string[] = []
                parts.push(`📋 ${proposalNumber} — ${proposal.title as string}`)
                parts.push(
                  [
                    client ? `Cliente: ${client.name}` : lead ? `Lead: ${lead.name}` : null,
                    `Estado: ${PROPOSAL_STATUS[status]?.label ?? status}`,
                    Number(proposal.total ?? 0) > 0 &&
                      `Total: ${formatEUR(Number(proposal.total))}`,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                )
                return parts
              })()}
              urlPath={`/proposals/${id}`}
            />
            <StatusBadge meta={PROPOSAL_STATUS} value={status} />
            {!locked ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={editing ? `/proposals/${id}` : `/proposals/${id}?mode=edit`}>
                  <Pencil aria-hidden />
                  {editing ? 'Ver' : 'Editar'}
                </Link>
              </Button>
            ) : null}
            {!editing ? (
              <>
                {status === 'accepted' ? (
                  needsFiscal ? (
                    <MarkAcceptedButton
                      proposalId={id}
                      needsFiscal={needsFiscal}
                      fiscalPrefill={fiscalPrefill}
                      alreadyAccepted
                    />
                  ) : (
                    <GenerateInvoiceButton
                      proposalId={id}
                      canGenerateInvoice={['owner', 'admin'].includes(user.role)}
                      paymentPlan={paymentPlan}
                    />
                  )
                ) : status !== 'rejected' ? (
                  <MarkAcceptedButton
                    proposalId={id}
                    needsFiscal={needsFiscal}
                    fiscalPrefill={fiscalPrefill}
                  />
                ) : null}
                {locked && <ReopenProposalButton proposalId={id} />}
                <ProposalMoreActions
                  proposalId={id}
                  canReject={
                    ['owner', 'admin'].includes(user.role) &&
                    ['sent', 'viewed', 'expired'].includes(status)
                  }
                />
              </>
            ) : null}
          </div>
        }
      />

      {editing ? (
        <SectionBoundary label="No se pudo cargar el editor de la propuesta">
          <ProposalEditor
            key={proposal.version as number}
            id={id}
            initialVersion={Number(proposal.version)}
            initialTitle={proposal.title as string}
            initialValidUntil={(proposal.valid_until as string | null) ?? null}
            initialNotes={(proposal.notes as string | null) ?? null}
            initialContextMarkdown={(proposal.context_markdown as string | null) ?? null}
            initialProblems={toEditableKeyPoints(parseKeyPoints(proposal.problems))}
            initialSolutions={toEditableKeyPoints(parseKeyPoints(proposal.solutions))}
            initialTerms={(proposal.terms as string | null) ?? null}
            initialScopeModules={parseScopeModules(proposal.scope_modules)}
            initialDeliverables={(proposal.deliverables as string | null) ?? null}
            initialAcceptanceCriteria={(proposal.acceptance_criteria as string | null) ?? null}
            initialPaymentSchedule={(proposal.payment_schedule as PaymentSchedule | null) ?? null}
            initialPaymentPlan={paymentPlan}
            initialPaymentTerms={(proposal.payment_terms as string | null) ?? null}
            initialChangeManagementTerms={
              (proposal.change_management_terms as string | null) ?? null
            }
            initialMaintenanceOptions={parseMaintenanceOffer(proposal.maintenance_options)}
            initialMaintenanceSelectedPlanId={
              (proposal.maintenance_selected_plan_id as string | null) ?? null
            }
            teamMembers={(teamMembers ?? []) as Parameters<typeof ProposalEditor>[0]['teamMembers']}
            initialTeamMemberIds={selectedTeamIds}
            initialItems={editableItems}
            aiEnabled={isAIEnabled()}
            leadId={lead?.id ?? null}
            autoGenerateDraft={ai_draft === '1'}
            locked={locked}
          />
        </SectionBoundary>
      ) : (
        <ProposalOverview
          total={Number(proposal.total ?? 0)}
          validUntil={(proposal.valid_until as string | null) ?? null}
          paymentPlan={paymentPlan}
          paymentTerms={(proposal.payment_terms as string | null) ?? null}
          items={((items ?? []) as Parameters<typeof ProposalOverview>[0]['items']).map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            vat_rate: Number(item.vat_rate),
            subtotal: Number(item.subtotal),
          }))}
          scopeModules={parseScopeModules(proposal.scope_modules)}
          deliverables={(proposal.deliverables as string | null) ?? null}
          acceptanceCriteria={(proposal.acceptance_criteria as string | null) ?? null}
          notes={(proposal.notes as string | null) ?? null}
          team={visibleTeam}
        />
      )}

      {status === 'accepted' ? (
        <ProposalPaymentPlan
          proposalId={id}
          initialPlan={paymentPlan}
          initialVersion={Number(proposal.version)}
          total={Number(proposal.total ?? 0)}
          canEdit={user.role !== 'viewer'}
          invoices={((paymentPlanInvoices ?? []) as Array<Record<string, unknown>>).flatMap(
            (invoice) => {
              const planItemId = invoice.proposal_payment_plan_item_id as string | null
              if (!planItemId) return []
              return [
                {
                  id: invoice.id as string,
                  planItemId,
                  number: (invoice.full_number as string | null) ?? 'Borrador',
                  status: invoice.status as string,
                },
              ]
            },
          )}
        />
      ) : null}

      {!editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Consultas del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalMessageThread
              messages={(messages ?? []) as unknown as ProposalMessage[]}
              submit={replyToProposalMessage.bind(null, id)}
            />
          </CardContent>
        </Card>
      ) : null}

      {!editing ? (
        <SectionBoundary label="No se pudo cargar la documentación técnica">
          <Card>
            <CardHeader>
              <CardTitle>Documentación técnica</CardTitle>
            </CardHeader>
            <CardContent>
              <ProposalSpecs
                proposalId={id}
                specs={((specs ?? []) as unknown as ProposalSpec[]).map((s) => ({
                  id: s.id,
                  title: s.title,
                  body_markdown: s.body_markdown,
                  is_client_visible: s.is_client_visible,
                  portal_token: s.portal_token,
                  updated_at: s.updated_at,
                  version: s.version,
                }))}
                aiEnabled={isAIEnabled()}
                locked={locked}
              />
            </CardContent>
          </Card>
        </SectionBoundary>
      ) : null}

      {!editing && isAIEnabled() && ['sent', 'viewed'].includes(status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Próximo paso comercial</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalFollowUpAssistant
              proposalId={id}
              leadId={lead?.id ?? null}
              clientId={client?.id ?? null}
            />
          </CardContent>
        </Card>
      ) : null}

      {!editing ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Compartir con el cliente</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {token ? (
                <>
                  <ShareLinks
                    token={token}
                    portalViewedAt={portalViewedAt}
                    deckViewedAt={deckViewedAt}
                    isDraft={status === 'draft'}
                  />
                  <PortalAccessControls
                    id={id}
                    initialVisible={(proposal.is_client_visible as boolean | null) ?? true}
                    hasPassword={Boolean(proposal.portal_password_hash)}
                    action={updateProposalPortalAccess}
                  />
                </>
              ) : null}
              {locked ? (
                <p className="text-muted-foreground text-xs">La propuesta ya ha sido respondida.</p>
              ) : (
                <SendPreviewButton
                  id={id}
                  defaultEmail={recipientEmail}
                  alreadySent={Boolean(proposal.sent_at)}
                />
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Información</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Estado">
                  <StatusBadge meta={PROPOSAL_STATUS} value={status} />
                </DetailRow>
                <DetailRow label={client ? 'Cliente' : 'Lead'}>
                  {client ? (
                    <Link href={`/clients/${client.id}`} className="hover:underline">
                      {client.name}
                    </Link>
                  ) : lead ? (
                    <Link href={`/leads/${lead.id}`} className="hover:underline">
                      {lead.company ? `${lead.name} · ${lead.company}` : lead.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Proyecto">
                  <LinkProjectButton
                    proposalId={id}
                    currentProject={project}
                    availableProjects={(availableProjects ?? []) as { id: string; name: string }[]}
                  />
                </DetailRow>
                <DetailRow label="Enviada">
                  {formatDate(proposal.sent_at as string | null)}
                </DetailRow>
                <DetailRow label="Vista">
                  {formatDate(proposal.viewed_at as string | null)}
                </DetailRow>
                <DetailRow label="Respondida">
                  {formatDate(proposal.responded_at as string | null)}
                </DetailRow>
              </DetailGrid>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Aperturas recientes</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {viewRows.length === 0 ? (
            <p className="text-muted-foreground px-6 py-4 text-sm">Aún no se ha abierto.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {viewRows.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-6 py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={v.viewer_type === 'client' ? 'info' : 'neutral'}>
                      {v.viewer_type === 'client' ? 'Cliente' : 'Equipo'}
                    </Badge>
                    <Badge variant="outline">
                      {v.surface === 'deck' ? (
                        <>
                          <Presentation aria-hidden /> Presentación
                        </>
                      ) : (
                        <>
                          <FileText aria-hidden /> Propuesta
                        </>
                      )}
                    </Badge>
                    <span className="text-muted-foreground">
                      {v.viewer_type === 'team'
                        ? (v.team_members?.name ?? 'Miembro')
                        : 'Apertura externa'}
                    </span>
                  </div>
                  <time
                    dateTime={v.viewed_at}
                    className="text-muted-foreground text-xs tabular-nums"
                  >
                    {new Date(v.viewed_at).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {depositPayments && depositPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Señal / Pagos de reserva</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border divide-y text-sm">
              {depositPayments.map((p) => {
                const pStatus = p.status as string
                const icon =
                  pStatus === 'confirmed' ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : pStatus === 'failed' ? (
                    <XCircle className="size-4 text-red-500" />
                  ) : (
                    <Clock className="size-4 text-amber-500" />
                  )
                return (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-3"
                  >
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="font-medium tabular-nums">
                        {formatEUR(Number(p.amount))}
                      </span>
                      <Badge
                        variant={
                          pStatus === 'confirmed'
                            ? 'success'
                            : pStatus === 'failed'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {pStatus === 'confirmed'
                          ? 'Confirmado'
                          : pStatus === 'failed'
                            ? 'Fallido'
                            : 'Pendiente'}
                      </Badge>
                      {p.confirmed_at && (
                        <span className="text-muted-foreground text-xs">
                          {formatDate(p.confirmed_at as string)}
                        </span>
                      )}
                    </div>
                    {p.invoice_id && (
                      <Link
                        href={`/invoices/${p.invoice_id}`}
                        className="text-primary text-xs hover:underline"
                      >
                        Ver factura →
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <AttachmentSection
        entityType="proposal"
        entityId={id}
        attachments={
          (attachments ?? []) as import('@/components/ui/attachment-section').AttachmentItem[]
        }
        canEdit={!locked}
      />
    </div>
  )
}
