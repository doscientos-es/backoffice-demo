import { type NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth'
import { externalAppUrl } from '@/lib/email/app-url'
import { publicEnv } from '@/lib/env'
import { isPortalUnlocked } from '@/lib/portal/access'
import { parseKeyPoints } from '@/lib/proposals/key-points'
import {
  maintenancePlanAsLineItem,
  parseMaintenanceOffer,
  selectedMaintenancePlan,
} from '@/lib/proposals/maintenance'
import {
  type ProposalPdfItem,
  proposalPdfFilename,
  renderProposalPdf,
} from '@/lib/proposals/proposal-pdf-document'
import { type PaymentSchedule, parseScopeModules } from '@/lib/proposals/scope'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Downloads the formal proposal PDF with the same access policy as its portal. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params
  const admin = createAdminClient()
  const auth = await getCurrentUser()
  const isTeam = auth.ok

  const { data: proposal } = await admin
    .from('proposals')
    .select('*, clients(name), leads(name, company)')
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!proposal || (proposal.status === 'draft' && !isTeam)) {
    return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  }
  if (!isTeam) {
    if ((proposal.is_client_visible as boolean | null) === false) {
      return NextResponse.json({ error: 'Propuesta no disponible' }, { status: 404 })
    }
    const unlocked = await isPortalUnlocked(
      token,
      (proposal.portal_password_hash as string | null) ?? null,
    )
    if (!unlocked) return NextResponse.redirect(new URL(`/p/proposal/${token}`, req.url))
  }

  const { data: items, error: itemsError } = await admin
    .from('proposal_items')
    .select('id, description, quantity, unit_price, vat_rate, subtotal, billing_cycle')
    .eq('proposal_id', proposal.id as string)
    .order('position')
  if (itemsError) return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 })
  const { data: settings } = await admin
    .from('settings')
    .select('company_name, iban')
    .eq('id', 1)
    .maybeSingle()

  const client = (proposal as unknown as { clients: { name: string } | null }).clients
  const lead = (
    proposal as unknown as { leads: { name: string | null; company: string | null } | null }
  ).leads
  const maintenanceOffer = parseMaintenanceOffer(proposal.maintenance_options)
  const maintenanceSelectedPlanId = (proposal.maintenance_selected_plan_id as string | null) ?? null
  const maintenancePlan = selectedMaintenancePlan(maintenanceOffer, maintenanceSelectedPlanId)
  const pdfItems: ProposalPdfItem[] = ((items ?? []) as Array<Record<string, unknown>>).map(
    (item): ProposalPdfItem => ({
      id: String(item.id),
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unit_price ?? 0),
      vatRate: Number(item.vat_rate ?? 0),
      subtotal: Number(item.subtotal ?? 0),
      billingCycle: (item.billing_cycle as string | null) ?? null,
    }),
  )
  if (maintenancePlan) {
    const item = maintenancePlanAsLineItem(maintenancePlan)
    pdfItems.push({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      vatRate: item.vat_rate,
      subtotal: item.subtotal,
      billingCycle: item.billing_cycle,
    })
  }
  const pdf = await renderProposalPdf({
    number: (proposal.number as string | null) ?? null,
    title: proposal.title as string,
    recipientName: client?.name ?? lead?.company ?? lead?.name ?? 'Cliente',
    validUntil: (proposal.valid_until as string | null) ?? null,
    context: (proposal.context_markdown as string | null) ?? null,
    problems: parseKeyPoints(proposal.problems),
    solutions: parseKeyPoints(proposal.solutions),
    scopeModules: parseScopeModules(proposal.scope_modules),
    deliverables: (proposal.deliverables as string | null) ?? null,
    acceptanceCriteria: (proposal.acceptance_criteria as string | null) ?? null,
    paymentSchedule: (proposal.payment_schedule as PaymentSchedule | null) ?? 'half_half',
    paymentTerms: (proposal.payment_terms as string | null) ?? null,
    changeManagementTerms: (proposal.change_management_terms as string | null) ?? null,
    terms: (proposal.terms as string | null) ?? null,
    notes: (proposal.notes as string | null) ?? null,
    subtotal: Number(proposal.subtotal ?? 0),
    taxAmount: Number(proposal.tax_amount ?? 0),
    total: Number(proposal.total ?? 0),
    items: pdfItems,
    maintenanceOffer,
    maintenanceSelectedPlanId,
    portalUrl: `${externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)}/p/proposal/${token}`,
    companyName: (settings?.company_name as string | null) ?? null,
    iban: (settings?.iban as string | null) ?? null,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${proposalPdfFilename((proposal.number as string | null) ?? null, proposal.id as string)}"`,
      'Content-Type': 'application/pdf',
    },
  })
}
