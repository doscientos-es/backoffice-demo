import { formatEUR } from '@/lib/utils'

export type InvoiceDisplayItem = {
  id: string
  description: string
  quantity: number | string | null
  unit_price: number | string | null
  vat_rate: number | string | null
  subtotal: number | string | null
}

export type InvoiceVatRow = { rate: number; base: number; tax: number }

type InvoiceItemsSummaryProps = {
  items: InvoiceDisplayItem[]
  subtotal: number
  total: number
  vatBreakdown: InvoiceVatRow[]
  variant?: 'app' | 'portal'
}

const quantityFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

export function InvoiceItemsSummary({
  items,
  subtotal,
  total,
  vatBreakdown,
  variant = 'app',
}: InvoiceItemsSummaryProps) {
  const portal = variant === 'portal'
  const muted = portal ? 'text-zinc-500 dark:text-zinc-400' : 'text-muted-foreground'
  const divider = portal ? 'divide-zinc-100 dark:divide-zinc-800/70' : 'divide-border'

  if (items.length === 0) {
    return <p className={`px-4 py-6 text-sm ${muted}`}>Sin conceptos.</p>
  }

  return (
    <section aria-label="Conceptos de la factura">
      <ul className={`divide-y ${divider}`}>
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3.5 sm:px-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <p className="leading-snug font-medium">{item.description}</p>
                <p className={`mt-1 text-xs tabular-nums ${muted}`}>
                  {quantityFormatter.format(Number(item.quantity ?? 0))} ×{' '}
                  {formatEUR(Number(item.unit_price ?? 0))}
                  <span aria-hidden="true"> · </span>
                  IVA {Number(item.vat_rate ?? 0)}%
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatEUR(Number(item.subtotal ?? 0))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div
        className={
          portal
            ? 'border-t border-zinc-200 bg-zinc-50/80 p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/60'
            : 'border-border bg-muted/30 border-t p-4 sm:p-5'
        }
      >
        <dl className="ml-auto flex w-full max-w-sm flex-col gap-2">
          <div className={`flex justify-between gap-4 text-sm ${muted}`}>
            <dt>Base imponible</dt>
            <dd className="tabular-nums">{formatEUR(subtotal)}</dd>
          </div>
          {vatBreakdown.map((row) => (
            <div key={row.rate} className={`flex justify-between gap-4 text-sm ${muted}`}>
              <dt>IVA {row.rate}%</dt>
              <dd className="tabular-nums">{formatEUR(row.tax)}</dd>
            </div>
          ))}
          <div
            className={
              portal
                ? 'mt-2 flex items-center justify-between rounded-lg bg-white px-4 py-3 text-base font-bold shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700'
                : 'bg-background ring-foreground/10 mt-2 flex items-center justify-between rounded-lg px-4 py-3 text-base font-semibold shadow-sm ring-1'
            }
          >
            <dt>Total</dt>
            <dd className="text-lg tabular-nums">{formatEUR(total)}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
