import 'server-only'
import { formatAddress } from '@/lib/address'
import { buildVatBreakdown, type VatBreakdownRow } from '@/lib/finance'

/**
 * Normalised, render-ready snapshot of an invoice for the PDF document.
 *
 * Built once on the server and shared by both the internal and portal PDF
 * routes so the generated document is identical regardless of the caller.
 */
export type InvoicePdfItem = {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  subtotal: number
}

/** Render-ready work-log entry shown on the PDF activity page. */
export type InvoicePdfWorkLog = {
  workDate: string | null
  memberName: string | null
  startTime: string | null
  endTime: string | null
  hours: number
  note: string | null
}

/** Raw work-log row both callers can shape from their own queries. */
export type InvoicePdfWorkLogInput = {
  work_date: string | null
  member_name: string | null
  start_time: string | null
  end_time: string | null
  hours: number | null
  note: string | null
}

export type InvoicePdfData = {
  fullNumber: string
  invoiceType: string | null
  status: string
  verifactuStatus: string | null
  issueDate: string | null
  dueDate: string | null
  idfact: string | null
  verifactuCsv: string | null
  clientName: string | null
  clientLogoUrl: string | null
  clientNif: string | null
  clientAddress: string | null
  company: {
    name: string | null
    nif: string | null
    address: string | null
    iban: string | null
  } | null
  items: InvoicePdfItem[]
  subtotal: number
  total: number
  vatBreakdown: VatBreakdownRow[]
  qrDataUrl: string | null
  /** Public portal URL so clients can pay online (shown in payment section). */
  portalUrl: string | null
  /** Payment terms shown in the payment section (per-invoice override or company default). */
  paymentTerms: string | null
  /** Tracked hours linked to this invoice, rendered on a second page. */
  workLogs: InvoicePdfWorkLog[]
}

/** Raw pieces both callers can shape from their own queries. */
export type BuildInvoicePdfInput = {
  invoice: {
    full_number: string | null
    invoice_type: string | null
    status: string | null
    verifactu_status: string | null
    issue_date: string | null
    due_date: string | null
    idfact: string | null
    verifactu_csv: string | null
    qr_url?: string | null
    subtotal: number | null
    total: number | null
    client_nif: string | null
    client_address_street?: string | null
    client_address_zip?: string | null
    client_address_city?: string | null
    client_address_province?: string | null
    client_address_country?: string | null
    /** Portal token used to build the public payment URL. */
    portal_token?: string | null
    /** Per-invoice override for the payment terms. */
    payment_terms?: string | null
  }
  clientName: string | null
  clientLogoUrl?: string | null
  items: ReadonlyArray<{
    description: string | null
    quantity: number | null
    unit_price: number | null
    vat_rate: number | null
    subtotal: number | null
  }>
  settings: {
    company_name: string | null
    company_nif: string | null
    company_address?: string | null
    iban: string | null
    /** Company-wide default payment terms. */
    payment_terms?: string | null
  } | null
  workLogs?: ReadonlyArray<InvoicePdfWorkLogInput>
}

/**
 * Build the Verifactu QR data URL when the invoice carries the required fiscal
 * data and has been accepted by AEAT. A QR must never be displayed for a
 * pending, rejected, or technically failed submission.
 */
async function buildInvoiceQr(
  invoice: BuildInvoicePdfInput['invoice'],
  emisorNif: string | null,
): Promise<string | null> {
  void invoice
  void emisorNif
  return null
}

/** Default payment term (Ley 3/2004): 30 days from the issue date. */
const DEFAULT_DUE_DAYS = 30

/** Returns an ISO date string `days` after the given ISO date, or `null`. */
function addDaysIso(isoDate: string | null, days: number): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Shape raw query rows into the render-ready {@link InvoicePdfData}. */
export async function buildInvoicePdfData(input: BuildInvoicePdfInput): Promise<InvoicePdfData> {
  const { invoice, items, settings } = input

  const normalisedItems: InvoicePdfItem[] = items.map((item) => ({
    description: item.description ?? '',
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    vatRate: Number(item.vat_rate ?? 0),
    subtotal: Number(item.subtotal ?? 0),
  }))

  const normalisedWorkLogs: InvoicePdfWorkLog[] = (input.workLogs ?? []).map((log) => ({
    workDate: log.work_date,
    memberName: log.member_name,
    startTime: log.start_time,
    endTime: log.end_time,
    hours: Number(log.hours ?? 0),
    note: log.note,
  }))

  return {
    fullNumber: invoice.full_number ?? '',
    invoiceType: invoice.invoice_type,
    status: invoice.status ?? 'draft',
    verifactuStatus: invoice.verifactu_status,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date ?? addDaysIso(invoice.issue_date, DEFAULT_DUE_DAYS),
    idfact: invoice.idfact,
    verifactuCsv: invoice.verifactu_csv,
    clientName: input.clientName,
    clientLogoUrl: input.clientLogoUrl ?? null,
    clientNif: invoice.client_nif,
    clientAddress:
      formatAddress({
        street: invoice.client_address_street,
        zip: invoice.client_address_zip,
        city: invoice.client_address_city,
        province: invoice.client_address_province,
        country: invoice.client_address_country,
      }) || null,
    company: settings
      ? {
          name: settings.company_name,
          nif: settings.company_nif,
          address: settings.company_address || null,
          iban: settings.iban,
        }
      : null,
    items: normalisedItems,
    subtotal: Number(invoice.subtotal ?? 0),
    total: Number(invoice.total ?? 0),
    vatBreakdown: buildVatBreakdown(
      normalisedItems.map((i) => ({ vat_rate: i.vatRate, subtotal: i.subtotal })),
    ),
    // New issued invoices persist this URL from the immutable RegistroAlta.
    // The legacy fallback only supports invoices emitted before qr_url existed.
    qrDataUrl: await buildInvoiceQr(invoice, settings?.company_nif || null),
    portalUrl: invoice.portal_token ? `/p/invoice/${invoice.portal_token}` : null,
    paymentTerms: invoice.payment_terms ?? settings?.payment_terms ?? null,
    workLogs: normalisedWorkLogs,
  }
}

/** Safe, descriptive download filename for an invoice PDF. */
export function invoicePdfFilename(fullNumber: string | null, fallbackId: string): string {
  const base = (fullNumber ?? fallbackId).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `factura-${base || fallbackId}.pdf`
}
