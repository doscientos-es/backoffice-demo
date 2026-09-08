import type { InvoiceActionInvoice } from './invoice-action-contracts'

/**
 * Centralizes which UI actions are legal for the current fiscal lifecycle.
 * Server actions remain the authority; this policy only keeps the UI honest.
 */
export function getInvoiceActionPolicy(invoice: InvoiceActionInvoice) {
  const isDraft = invoice.status === 'draft'
  const isIssued = invoice.status === 'issued'
  const isPaid = invoice.status === 'paid'
  const isOverdue = invoice.status === 'overdue'
  const hasFiscalProblem =
    invoice.verifactu_status === 'error' || invoice.verifactu_status === 'rejected'
  const requiresRegularization =
    invoice.verifactu_status === 'rejected' || invoice.fiscal_delivery_state === 'terminal_error'

  return {
    canEdit: isDraft,
    canIssue: isDraft,
    canSendEmail: !isDraft,
    canRecordPayment: isIssued || isOverdue,
    canRevertPayment: isPaid,
    canMarkUncollectible: (isIssued || isOverdue) && !invoice.is_uncollectible,
    canCancel: isIssued || isOverdue,
    canDelete: invoice.verifactu_status !== 'accepted',
    canRectify: (isIssued || isPaid || isOverdue) && !invoice.is_rectification,
    shouldSendToAeat:
      !isDraft &&
      invoice.verifactu_status !== 'accepted' &&
      invoice.verifactu_status !== 'excluded' &&
      !requiresRegularization,
    shouldRegularizeAeat: requiresRegularization,
    hasFiscalProblem,
  }
}

export function aeatDeliveryLabel(verifactuStatus: string): string {
  if (verifactuStatus === 'rejected') return 'Regularizar AEAT'
  if (verifactuStatus === 'error') return 'Reintentar envío'
  return 'Enviar a AEAT'
}
