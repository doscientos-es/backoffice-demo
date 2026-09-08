export const RECTIFIABLE_INVOICE_STATUSES = ['issued', 'paid', 'overdue'] as const

export function isRectifiableInvoice({
  status,
  isRectification,
}: {
  status: string
  isRectification: boolean
}): boolean {
  return (RECTIFIABLE_INVOICE_STATUSES as readonly string[]).includes(status) && !isRectification
}

export function getMonthlyBillingWindow(month: string): { start: string; end: string } {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7))
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10),
  }
}

export function buildInvoiceItemRows(
  items: Array<{ description: string; quantity: number; unit_price: number; vat_rate: number }>,
) {
  return items.map((item, position) => ({ ...item, position }))
}
