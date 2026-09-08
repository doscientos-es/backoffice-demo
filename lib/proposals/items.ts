import { computeProposalTotals } from '@/lib/finance'

export type ProposalItemInput = {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  billing_cycle: 'none' | 'monthly' | 'quarterly' | 'yearly' | null | undefined
}

export function buildProposalItemRows(items: ProposalItemInput[], proposalId: string) {
  return items.map((item, position) => ({
    proposal_id: proposalId,
    position,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate,
    billing_cycle: item.billing_cycle,
  }))
}

export function buildProposalTotalsPatch(items: ProposalItemInput[]) {
  const { oneTime } = computeProposalTotals(items)
  return {
    subtotal: oneTime.subtotal,
    tax_amount: oneTime.taxAmount,
    total: oneTime.total,
  }
}

export function isProposalEditable(status: string | null | undefined): boolean {
  return status !== 'accepted' && status !== 'rejected'
}
