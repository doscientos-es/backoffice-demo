export type OutboxDelivery = {
  processed: boolean
  status: 'accepted' | 'rejected' | 'error' | 'skipped' | 'deferred'
  csv: string | null
  error?: string | null
  warnings: Array<{ code: string | null; message: string }>
}

export const MISSING_DURABLE_FISCAL_RECORD_MESSAGE = 'El registro fiscal no está disponible en la demo.'
export const REJECTED_RECORD_REQUIRES_REGULARIZATION_MESSAGE = 'La regularización fiscal está desactivada en la demo.'
export const TERMINAL_RECORD_REQUIRES_REGULARIZATION_MESSAGE = 'La entrega fiscal está desactivada en la demo.'

export const formatOutboxError = (error: string | null | undefined) => error ?? 'Operación fiscal simulada.'
export const isRetryableVerifactuDelivery = () => false
export const normalizeAltaRechazoPrevio = (value: string | null | undefined) => value || undefined
export const resolveVerifactuSoftwareSnapshot = <T>(payload: T, fallback: unknown) =>
  (payload as { software?: unknown }).software ?? fallback

const simulatedDelivery = (): OutboxDelivery => ({
  processed: false,
  status: 'skipped',
  csv: null,
  error: 'La entrega a AEAT está desactivada en la demo.',
  warnings: [{ code: 'demo', message: 'No se ha realizado ninguna conexión externa.' }],
})

export async function assertDurableVerifactuPackage(_requireCancellation = false): Promise<void> {}
export async function deliverVerifactuOutbox(_outboxId: string, _workerId: string): Promise<OutboxDelivery> { return simulatedDelivery() }
export async function deliverInvoiceVerifactu(_invoiceId: string, _workerId: string): Promise<OutboxDelivery> { return simulatedDelivery() }
export async function syncInvoiceQrFromLedger(_invoiceId: string): Promise<void> {}
export async function retryDueVerifactuOutbox(_limit = 10): Promise<OutboxDelivery[]> { return [] }