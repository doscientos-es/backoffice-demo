import { CircleCheck as CheckCircle2 } from 'lucide-react'

import { LogoMark } from '@/components/branding'
import { ReceiptPrintButton } from '@/components/portal/receipt-print-button'
import { formatDate, formatEUR } from '@/lib/utils'

interface PaymentReceiptProps {
  /** Redsys order reference shown under the title. */
  orderRef: string | null
  /** Issuer company data from settings. */
  company: {
    name?: string | null
    nif?: string | null
    address?: string | null
  }
  /** Who paid (client/lead) and their fiscal id. */
  recipientName: string
  recipientNif?: string | null
  /** "En concepto de" block: main line and supporting detail. */
  conceptTitle: string
  conceptSubtitle: string
  /** Confirmed payment data. */
  confirmedAt: string | null
  authorisationCode?: string | null
  amount: number
  /** Closing legal note tailored to invoice vs proposal. */
  footerNote: string
}

/**
 * Shared layout for the public payment receipt ("Justificante de Pago").
 * Used by both invoice and proposal portals; only the surrounding data
 * fetching and a few labels differ between them.
 */
export function PaymentReceipt({
  orderRef,
  company,
  recipientName,
  recipientNif,
  conceptTitle,
  conceptSubtitle,
  confirmedAt,
  authorisationCode,
  amount,
  footerNote,
}: PaymentReceiptProps) {
  return (
    <div className="min-h-screen bg-zinc-50 p-4 sm:p-8 dark:bg-zinc-950 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {/* Header with Print button (hidden on print) */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Pago confirmado</span>
          </div>
          <ReceiptPrintButton />
        </div>

        {/* The Receipt Document */}
        <article className="border border-zinc-200 bg-white p-8 shadow-sm sm:p-12 dark:border-zinc-800 dark:bg-zinc-900 print:border-none print:shadow-none">
          <div className="mb-12 flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <LogoMark size={24} className="text-[#2A4227] dark:text-[#9CC196]" />
                <span className="text-sm font-bold tracking-wider text-zinc-900 uppercase dark:text-zinc-100">
                  doscientos
                </span>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Justificante de Pago
              </h1>
              <p className="text-sm text-zinc-500">Ref: {orderRef}</p>
            </div>
            {company.name && (
              <div className="flex flex-col gap-1 text-right">
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{company.name}</p>
                <p className="text-xs text-zinc-500">{company.nif}</p>
                <p className="max-w-50 text-xs whitespace-pre-line text-zinc-500">
                  {company.address}
                </p>
              </div>
            )}
          </div>

          <div className="mb-12 grid grid-cols-2 gap-12 border-y border-zinc-100 py-8 dark:border-zinc-800">
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-1 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                  Pagado por
                </p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {recipientName}
                </p>
                {recipientNif && <p className="text-xs text-zinc-500">NIF: {recipientNif}</p>}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                  En concepto de
                </p>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {conceptTitle}
                </p>
                <p className="text-xs text-zinc-500">{conceptSubtitle}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-1 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                  Detalles del pago
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Fecha:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDate(confirmedAt as string)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Método:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Tarjeta / Bizum (Redsys)
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Autorización:</span>
                    <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {authorisationCode ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end py-6">
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs font-medium text-zinc-500">Importe abonado</p>
              <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatEUR(amount)}
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-zinc-100 pt-8 text-center dark:border-zinc-800">
            <p className="mx-auto max-w-md text-[10px] leading-relaxed text-zinc-400">
              {footerNote}
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}
