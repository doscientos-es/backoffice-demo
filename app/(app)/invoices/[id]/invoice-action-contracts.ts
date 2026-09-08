import type { InvoiceIssuancePhase } from './invoice-issuance-progress-dialog'

export type InvoiceActionInvoice = {
  id: string
  status: string
  verifactu_status: string
  verifactu_error: string | null
  fiscal_delivery_state?: string | null
  is_regularization_pending?: boolean
  is_rectification?: boolean
  is_uncollectible?: boolean
  total: number
  amountPaid: number
}

export type InvoiceStatusChange = 'issued' | 'paid' | 'cancelled'

export type InvoiceFeedback = {
  setPending: () => void
  setSuccess: (message?: string) => void
  setError: (message: string) => void
}

export type VerifyInvoiceStatusChange = (status: InvoiceStatusChange) => Promise<boolean>

export type InvoiceIssuanceResult = {
  phase: InvoiceIssuancePhase
  error: string | null
  csv: string | null
}
