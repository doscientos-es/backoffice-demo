import {
  CircleCheck as CheckCircle2,
  Download,
  FileText,
  Presentation,
  XCircle,
} from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { PortalPasswordGate } from '@/components/portal/password-gate'
import { ProposalPaymentOptions } from '@/components/portal/proposal-payment-options'
import {
  type ProposalMessage,
  ProposalMessageThread,
} from '@/components/proposals/proposal-message-thread'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Markdown } from '@/components/ui/markdown'
import { formatAddress } from '@/lib/address'
import { getCurrentUser } from '@/lib/auth'
import { BILLING_CYCLE_LABELS, type BillingCycle, computeProposalTotals } from '@/lib/finance'
import { scopedLogger } from '@/lib/logger'
import { isPortalUnlocked } from '@/lib/portal/access'
import { parseKeyPoints } from '@/lib/proposals/key-points'
import {
  maintenancePlanAsLineItem,
  parseMaintenanceOffer,
  selectedMaintenancePlan,
} from '@/lib/proposals/maintenance'
import {
  PAYMENT_SCHEDULE_LABELS,
  type PaymentSchedule,
  parseScopeModules,
  paymentInitialPercentage,
  scopeModuleDurationText,
} from '@/lib/proposals/scope'
import type { ProposalStatus } from '@/lib/status'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatEUR } from '@/lib/utils'

import { sendProposalQuestion, unlockProposalPortal } from './actions'
import { PortalKeyPointsList, PortalNarrativeBlock } from './narrative'
import { ProposalActions } from './proposal-actions'
import { ProposalMaintenanceOptions } from './proposal-maintenance-options'

const log = scopedLogger('portal.proposal')

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Propuesta · doscientos',
  robots: { index: false, follow: false },
}

type ProposalItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  subtotal: number
  billing_cycle: BillingCycle | null
}

function ScopeBullets({
  label,
  items,
  tone,
}: {
  label: string
  items: string[]
  tone: 'included' | 'excluded'
}) {
  return (
    <div>
      <p
        className={`text-xs font-semibold ${tone === 'included' ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}
      >
        {label}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProposalTextBlock({ label, source }: { label: string; source: string }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
      <Markdown source={source} className="text-sm text-zinc-600 dark:text-zinc-400" />
    </section>
  )
}

function PresentationLink({ token }: { token: string }) {
  return (
    <a
      href={`/deck/${token}`}
      className="group flex items-center gap-3 rounded-lg border border-[#2A4227]/20 bg-[#2A4227]/3 p-3 text-zinc-900 transition-colors hover:border-[#2A4227]/50 hover:bg-[#2A4227]/[0.07] dark:border-[#9CC196]/25 dark:bg-[#9CC196]/5 dark:text-zinc-100 dark:hover:border-[#9CC196]/60 dark:hover:bg-[#9CC196]/10"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-[#2A4227] shadow-sm ring-1 ring-[#2A4227]/10 dark:bg-zinc-900 dark:text-[#9CC196] dark:ring-[#9CC196]/15">
        <Presentation className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Presentación del proyecto</span>
        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
          Recorre la propuesta en formato visual
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-[#2A4227] transition-transform group-hover:translate-x-0.5 dark:text-[#9CC196]">
        Abrir <span aria-hidden>→</span>
      </span>
    </a>
  )
}

export default async function PortalProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { token } = await params
  const { success, error } = await searchParams
  const admin = createAdminClient()

  // Resolve auth first so team members can preview drafts.
  const auth = await getCurrentUser()
  const isTeam = auth.ok

  const { data: proposal, error: proposalError } = await admin
    .from('proposals')
    .select(
      '*, clients(name, nif, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country, email, phone, contact_person, logo_url), leads(name, email, phone, company)',
    )
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  // Drafts are only accessible to authenticated team members.
  if (proposalError) {
    log.error({ err: proposalError }, 'portal_proposal_lookup_failed')
    notFound()
  }
  if (!proposal) {
    log.error({ token }, 'portal_proposal_not_found — query returned null')
    notFound()
  }
  if (proposal.status === 'draft' && !isTeam) {
    log.warn({ proposalId: proposal.id, status: proposal.status }, 'portal_draft_blocked_non_team')
    notFound()
  }

  const isDraft = proposal.status === 'draft'

  // Client-facing access gate: hidden proposals 404 and password-protected
  // ones show the unlock form until the visitor presents a valid cookie. Team
  // members always bypass so they can preview the link.
  if (!isTeam) {
    if ((proposal.is_client_visible as boolean | null) === false) {
      log.warn({ proposalId: proposal.id }, 'portal_proposal_hidden_from_client')
      notFound()
    }
    const unlocked = await isPortalUnlocked(
      token,
      (proposal.portal_password_hash as string | null) ?? null,
    )
    if (!unlocked) {
      return <PortalPasswordGate token={token} action={unlockProposalPortal} />
    }
  }

  const { data: items } = await admin
    .from('proposal_items')
    .select('id, position, description, quantity, unit_price, vat_rate, subtotal, billing_cycle')
    .eq('proposal_id', proposal.id as string)
    .order('position')

  const { data: specs } = await admin
    .from('proposal_specs')
    .select('id, title, portal_token')
    .eq('proposal_id', proposal.id as string)
    .eq('is_client_visible', true)
    .not('portal_token', 'is', null)
  const { data: messages } = await admin
    .from('proposal_messages')
    .select('id, author_type, author_name, body, created_at')
    .eq('proposal_id', proposal.id as string)
    .order('created_at', { ascending: true })
  const { data: settings } = await admin
    .from('settings')
    .select('company_name, iban')
    .eq('id', 1)
    .maybeSingle()

  // Bump status from 'sent' to 'viewed' only on the first external (client)
  // view. Team previews and drafts never transition the status.
  if (!isTeam && !isDraft && proposal.status === 'sent') {
    await admin
      .from('proposals')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', proposal.id as string)
      .eq('status', 'sent')
  }

  // Best-effort view tracking. Skipped for draft previews.
  if (!isDraft) {
    try {
      const h = await headers()
      const forwarded = h.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0]?.trim() : (h.get('x-real-ip') ?? null)
      const userAgent = h.get('user-agent')
      await admin.from('proposal_view_events').insert({
        proposal_id: proposal.id as string,
        viewer_type: isTeam ? 'team' : 'client',
        team_member_id: isTeam ? auth.user.id : null,
        surface: 'portal',
        ip,
        user_agent: userAgent,
      })
    } catch (err) {
      log.warn({ err, proposalId: proposal.id }, 'proposal_view_insert_failed')
    }
  }

  const client = (
    proposal as unknown as {
      clients: {
        name: string
        nif: string | null
        billing_address_street: string | null
        billing_address_zip: string | null
        billing_address_city: string | null
        billing_address_province: string | null
        billing_address_country: string | null
        email: string | null
        phone: string | null
        contact_person: string | null
        logo_url: string | null
      } | null
    }
  ).clients
  const lead = (
    proposal as unknown as {
      leads: {
        name: string
        email: string | null
        phone: string | null
        company: string | null
      } | null
    }
  ).leads
  const status = proposal.status as ProposalStatus
  const responded = status === 'accepted' || status === 'rejected'
  const statusLabel =
    status === 'draft'
      ? 'Vista previa del equipo'
      : status === 'accepted'
        ? 'Aceptada'
        : status === 'rejected'
          ? 'No aceptada'
          : status === 'expired'
            ? 'Caducada'
            : 'Pendiente de tu respuesta'

  // The lead branch always asks for fiscal data (no `clients` row exists yet).
  // The client branch only asks when the legal minimum (name + NIF + billing
  // address) is missing — typically a placeholder client created by the
  // back-office for prospects that never went through onboarding.
  const clientBillingAddress = client
    ? formatAddress({
        street: client.billing_address_street,
        zip: client.billing_address_zip,
        city: client.billing_address_city,
        province: client.billing_address_province,
        country: client.billing_address_country,
      })
    : ''
  const needsFiscal = !client?.nif?.trim() || !clientBillingAddress || !client.name?.trim()
  const fiscalPrefill = client
    ? {
        name: client.name ?? '',
        nif: client.nif ?? '',
        billing_address: clientBillingAddress,
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
  const recipientName = client?.name ?? lead?.company ?? lead?.name ?? '—'
  const proposalNumber = (proposal.number as string | null) ?? 'Borrador'
  const baseItems = (items ?? []) as unknown as ProposalItem[]
  const safeSpecs = (specs ?? []) as unknown as Array<{
    id: string
    title: string
    portal_token: string
  }>
  const proposalMessages = (messages ?? []) as unknown as ProposalMessage[]
  const contextMarkdown = ((proposal.context_markdown as string | null) ?? '').trim()
  const problems = parseKeyPoints(proposal.problems)
  const solutions = parseKeyPoints(proposal.solutions)
  const terms = (proposal.terms as string | null) ?? null
  const scopeModules = parseScopeModules(proposal.scope_modules)
  const deliverables = ((proposal.deliverables as string | null) ?? '').trim()
  const acceptanceCriteria = ((proposal.acceptance_criteria as string | null) ?? '').trim()
  const paymentSchedule = (proposal.payment_schedule as PaymentSchedule | null) ?? 'half_half'
  const paymentTerms = (proposal.payment_terms as string | null) ?? null
  const changeManagementTerms = (proposal.change_management_terms as string | null) ?? null
  const maintenanceOffer = parseMaintenanceOffer(proposal.maintenance_options)
  const maintenancePlan = selectedMaintenancePlan(
    maintenanceOffer,
    (proposal.maintenance_selected_plan_id as string | null) ?? null,
  )
  const safeItems = maintenancePlan
    ? [...baseItems, maintenancePlanAsLineItem(maintenancePlan)]
    : baseItems

  // Recompute totals on the fly so we can show separate buckets for one-time
  // and recurring lines. The stored `proposals.total` reflects the one-time
  // portion only — kept in sync by the proposal actions.
  const totals = computeProposalTotals(
    safeItems.map((it) => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
      billing_cycle: it.billing_cycle ?? 'none',
    })),
  )
  const hasRecurring =
    totals.monthly.total > 0 || totals.quarterly.total > 0 || totals.yearly.total > 0

  // Fetch confirmed payments for this proposal (signal/deposit)
  const { data: proposalPayments } = await admin
    .from('invoice_payments')
    .select('id, amount, status, created_at')
    .eq('proposal_id', proposal.id as string)
    .eq('status', 'confirmed')

  const confirmedPayments = proposalPayments ?? []
  const signalPaid = confirmedPayments.length > 0
  const initialPaymentPercentage = paymentInitialPercentage(paymentSchedule)
  const depositAmount =
    initialPaymentPercentage === null
      ? null
      : Math.round(Number(proposal.total) * initialPaymentPercentage) / 100

  return (
    <div className="flex flex-col gap-4">
      {isDraft && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="tracking-wider uppercase">Borrador</span>
          <span className="opacity-50">·</span>
          <span className="font-normal opacity-75">Vista previa — solo visible para el equipo</span>
        </div>
      )}
      {success && (
        <Alert className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-300">
            Pago confirmado
          </AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            Hemos recibido el pago de la señal. El proyecto se pondrá en marcha en breve.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error en el pago</AlertTitle>
          <AlertDescription>
            No se ha podido procesar el pago. Por favor, inténtalo de nuevo o contacta con nosotros.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <article className="overflow-hidden border-y border-zinc-200 dark:border-zinc-800">
          {/* Document header */}
          <header className="border-b border-zinc-200 px-6 py-6 sm:px-8 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
                  Propuesta · {proposalNumber}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {statusLabel}
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100">
                  {proposal.title as string}
                </h1>
                {proposal.valid_until ? (
                  <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                    Válida hasta el{' '}
                    <strong className="text-zinc-700 dark:text-zinc-300">
                      {formatDate(proposal.valid_until as string)}
                    </strong>
                  </p>
                ) : null}
              </div>
              <a
                href={`/p/proposal/${token}/pdf`}
                className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#2A4227] transition-colors hover:border-[#2A4227] hover:bg-[#2A4227]/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-[#9CC196] dark:hover:border-[#9CC196]"
              >
                <Download className="size-3.5" />
                Descargar PDF
              </a>
            </div>
          </header>

          {/* Recipient */}
          <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-5 sm:px-8 dark:border-zinc-800/60 dark:bg-zinc-900/50">
            <p className="mb-2 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
              Dirigido a
            </p>
            <div className="flex items-center gap-3">
              {client?.logo_url ? (
                // biome-ignore lint/performance/noImgElement: URL externa del logo del cliente, no compatible con next/image
                <img
                  src={client.logo_url}
                  alt={`Logo ${recipientName}`}
                  className="size-8 rounded object-contain"
                />
              ) : null}
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {recipientName}
              </p>
            </div>
          </div>

          {/* Narrative: Context → Problems → Solutions (always before price) */}
          {contextMarkdown || problems.length > 0 || solutions.length > 0 ? (
            <div className="flex flex-col divide-y divide-zinc-100 border-b border-zinc-100 dark:divide-zinc-800/60 dark:border-zinc-800/60">
              {contextMarkdown ? (
                <PortalNarrativeBlock label="Contexto">
                  <Markdown source={contextMarkdown} />
                </PortalNarrativeBlock>
              ) : null}
              {problems.length > 0 ? (
                <PortalNarrativeBlock label="Problemas detectados">
                  <PortalKeyPointsList items={problems} variant="problems" />
                </PortalNarrativeBlock>
              ) : null}
              {solutions.length > 0 ? (
                <PortalNarrativeBlock label="Cómo lo abordamos">
                  <PortalKeyPointsList items={solutions} variant="solutions" />
                </PortalNarrativeBlock>
              ) : null}
            </div>
          ) : null}

          {(scopeModules.length > 0 || deliverables || acceptanceCriteria) && (
            <div className="border-b border-zinc-100 px-6 py-7 sm:px-8 dark:border-zinc-800/60">
              <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                Alcance del proyecto
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {scopeModules.map((module, index) => (
                  <section
                    key={module.id}
                    className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <p className="text-[11px] font-semibold tracking-widest text-[#2A4227] uppercase dark:text-[#9CC196]">
                      Módulo {String(index + 1).padStart(2, '0')}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {module.title}
                    </h2>
                    {module.description ? (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {module.description}
                      </p>
                    ) : null}
                    {scopeModuleDurationText(module) ? (
                      <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Plazo estimado: {scopeModuleDurationText(module)}
                      </p>
                    ) : null}
                    {(module.included.length > 0 || module.excluded.length > 0) && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {module.included.length > 0 ? (
                          <ScopeBullets label="Incluido" items={module.included} tone="included" />
                        ) : null}
                        {module.excluded.length > 0 ? (
                          <ScopeBullets
                            label="No incluido"
                            items={module.excluded}
                            tone="excluded"
                          />
                        ) : null}
                      </div>
                    )}
                    {module.notes ? (
                      <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        <strong>Notas:</strong> {module.notes}
                      </p>
                    ) : null}
                  </section>
                ))}
                {deliverables || acceptanceCriteria ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {deliverables ? (
                      <ProposalTextBlock label="Entregables" source={deliverables} />
                    ) : null}
                    {acceptanceCriteria ? (
                      <ProposalTextBlock
                        label="Criterios de aceptación"
                        source={acceptanceCriteria}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Line items */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-8 py-3 text-left text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                    Descripción
                  </th>
                  {hasRecurring ? (
                    <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                      Cadencia
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-right text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                    Cant.
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                    IVA
                  </th>
                  <th className="px-8 py-3 text-right text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {safeItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={hasRecurring ? 6 : 5}
                      className="px-8 py-6 text-sm text-zinc-400 dark:text-zinc-600"
                    >
                      Sin líneas.
                    </td>
                  </tr>
                ) : (
                  safeItems.map((item, i) => {
                    const cycle: BillingCycle = item.billing_cycle ?? 'none'
                    return (
                      <tr
                        key={item.id}
                        className={i > 0 ? 'border-t border-zinc-100 dark:border-zinc-800/60' : ''}
                      >
                        <td className="px-8 py-3.5 text-zinc-800 dark:text-zinc-200">
                          {item.description}
                        </td>
                        {hasRecurring ? (
                          <td className="px-4 py-3.5 text-left text-xs">
                            {cycle === 'none' ? (
                              <span className="text-zinc-400 dark:text-zinc-600">
                                {BILLING_CYCLE_LABELS.none}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-[#2A4227]/10 px-2 py-0.5 font-medium text-[#2A4227] dark:bg-[#9CC196]/10 dark:text-[#9CC196]">
                                {BILLING_CYCLE_LABELS[cycle]}
                              </span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-4 py-3.5 text-right text-zinc-600 tabular-nums dark:text-zinc-400">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3.5 text-right text-zinc-600 tabular-nums dark:text-zinc-400">
                          {formatEUR(item.unit_price)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-zinc-600 tabular-nums dark:text-zinc-400">
                          {item.vat_rate}%
                        </td>
                        <td className="px-8 py-3.5 text-right font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
                          {formatEUR(item.subtotal)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end border-t border-zinc-200 px-8 py-5 dark:border-zinc-800">
            <div className="flex w-64 flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                {hasRecurring ? (
                  <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                    Inversión inicial
                  </p>
                ) : null}
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatEUR(totals.oneTime.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>IVA</span>
                  <span className="tabular-nums">{formatEUR(totals.oneTime.taxAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                  <span>Total</span>
                  <span className="tabular-nums">{formatEUR(totals.oneTime.total)}</span>
                </div>
              </div>

              {hasRecurring ? (
                <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                    Mantenimiento recurrente
                  </p>
                  {totals.monthly.total > 0 ? (
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Mensual</span>
                      <span className="font-medium tabular-nums">
                        {formatEUR(totals.monthly.total)}
                      </span>
                    </div>
                  ) : null}
                  {totals.quarterly.total > 0 ? (
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Trimestral</span>
                      <span className="font-medium tabular-nums">
                        {formatEUR(totals.quarterly.total)}
                      </span>
                    </div>
                  ) : null}
                  {totals.yearly.total > 0 ? (
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Anual</span>
                      <span className="font-medium tabular-nums">
                        {formatEUR(totals.yearly.total)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {paymentTerms || changeManagementTerms || terms ? (
            <div className="border-t border-zinc-100 bg-zinc-50 px-8 py-6 dark:border-zinc-800/60 dark:bg-zinc-900/50">
              <p className="mb-4 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                Condiciones
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                {paymentTerms ? (
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Forma de pago
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#2A4227] dark:text-[#9CC196]">
                      {PAYMENT_SCHEDULE_LABELS[paymentSchedule]}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {paymentTerms}
                    </p>
                  </div>
                ) : null}
                {changeManagementTerms ? (
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Cambios de alcance
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {changeManagementTerms}
                    </p>
                  </div>
                ) : null}
                {terms ? (
                  <div className="lg:col-span-2">
                    <Markdown source={terms} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Notes */}
          {(proposal.notes as string | null) ? (
            <div className="border-t border-zinc-100 bg-zinc-50 px-8 py-5 dark:border-zinc-800/60 dark:bg-zinc-900/50">
              <p className="mb-2 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                Notas
              </p>
              <Markdown
                source={proposal.notes as string}
                className="text-zinc-700 dark:text-zinc-300"
              />
            </div>
          ) : null}

          {/* Technical specs */}
          {safeSpecs.length > 0 ? (
            <div className="flex flex-col gap-4 border-t border-zinc-200 px-8 py-6 dark:border-zinc-800">
              <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
                Documentación técnica
              </p>
              <ul className="flex flex-col gap-2">
                {safeSpecs.map((spec) => (
                  <li key={spec.id}>
                    <a
                      href={`/p/spec/${spec.portal_token}`}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 transition-colors hover:border-[#2A4227] hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/50"
                    >
                      <FileText className="size-4 shrink-0 text-zinc-400 dark:text-zinc-600" />
                      <span className="flex-1 truncate font-medium">{spec.title}</span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">Abrir →</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-6">
          {!isDraft && !responded ? (
            <div className="hidden lg:block">
              <ProposalActions
                token={token}
                needsFiscal={needsFiscal}
                fiscalPrefill={fiscalPrefill}
              />
            </div>
          ) : null}
          <ProposalMessageThread
            messages={proposalMessages}
            submit={sendProposalQuestion.bind(null, token)}
            disabled={isDraft || responded || isTeam}
            sticky={false}
          />
          <section className="hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 lg:block dark:bg-zinc-900 dark:ring-zinc-800">
            <p className="mb-3 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
              Presentación
            </p>
            <PresentationLink token={token} />
          </section>
        </aside>

        {maintenanceOffer.enabled ? (
          <ProposalMaintenanceOptions
            token={token}
            offer={maintenanceOffer}
            selectedPlanId={(proposal.maintenance_selected_plan_id as string | null) ?? null}
            disabled={isDraft || responded || isTeam}
          />
        ) : null}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 lg:hidden dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mb-3 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
            Presentación
          </p>
          <PresentationLink token={token} />
        </section>
      </div>

      {/* Response area — hidden for draft previews */}
      {!isDraft && responded ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
            Respondida el {formatDate(proposal.responded_at as string | null)}.
          </p>

          {status === 'accepted' && !signalPaid && !isTeam && depositAmount !== null && (
            <ProposalPaymentOptions
              proposalId={proposal.id as string}
              token={token}
              proposalNumber={proposalNumber}
              initialPaymentPercentage={initialPaymentPercentage ?? 0}
              depositAmount={depositAmount}
              companyName={(settings?.company_name as string | null) ?? null}
              iban={(settings?.iban as string | null) ?? null}
            />
          )}

          {status === 'accepted' && signalPaid && confirmedPayments[0] && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/20">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Primer pago abonado ({formatEUR(confirmedPayments[0].amount)})
                </span>
              </div>
              <a
                href={`/p/proposal/${token}/receipt/${confirmedPayments[0].id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-[#2A4227] hover:underline dark:text-[#9CC196]"
              >
                <FileText className="size-3.5" />
                Ver justificante de pago
              </a>
            </div>
          )}
        </div>
      ) : !isDraft ? (
        <div className="lg:hidden">
          <ProposalActions token={token} needsFiscal={needsFiscal} fiscalPrefill={fiscalPrefill} />
        </div>
      ) : null}
    </div>
  )
}
