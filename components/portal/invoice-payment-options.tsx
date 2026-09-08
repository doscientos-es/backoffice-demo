'use client'

import { CreditCard, Landmark } from 'lucide-react'

import { CopyButton } from '@/components/ui/copy-button'
import { formatEUR } from '@/lib/utils'

import { RedsysPaymentButton } from './redsys-payment-button'

interface InvoicePaymentOptionsProps {
  invoiceId: string
  token: string
  total: number
  amountPaid: number
  invoiceNumber: string
  companyName: string | null
  iban: string | null
}

/** Shows the online gateway and bank-transfer alternatives for an unpaid invoice. */
export function InvoicePaymentOptions({
  invoiceId,
  token,
  total,
  amountPaid,
  invoiceNumber,
  companyName,
  iban,
}: InvoicePaymentOptionsProps) {
  const amountDue = Math.round((total - amountPaid) * 100) / 100
  const transferConcept = `Factura ${invoiceNumber}`
  const transferCopyText = [
    `Beneficiario: ${companyName ?? '—'}`,
    `IBAN: ${iban ?? '—'}`,
    `Concepto: ${transferConcept}`,
    `Importe: ${formatEUR(amountDue)}`,
  ].join('\n')

  return (
    <section aria-labelledby="payment-options-title" className="flex flex-col gap-3">
      <div>
        <h2 id="payment-options-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Elige cómo pagar
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Importe pendiente: <strong className="text-zinc-900 tabular-nums dark:text-zinc-100">{formatEUR(amountDue)}</strong>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-800 dark:bg-zinc-800">
          <div className="mb-5 flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
            <div>
              <h3 className="font-bold text-white">Tarjeta o Bizum</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Paga de forma segura mediante nuestra pasarela de pago integrada.
              </p>
            </div>
          </div>
          <RedsysPaymentButton
            invoiceId={invoiceId}
            token={token}
            total={total}
            amountPaid={amountPaid}
          />
        </div>

        {iban ? (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="mb-5 flex items-start gap-3">
              <Landmark className="mt-0.5 size-5 shrink-0 text-zinc-700 dark:text-zinc-300" aria-hidden />
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Transferencia bancaria</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  También puede realizar una transferencia normal con estos datos.
                </p>
              </div>
            </div>

            <dl className="grid gap-3 text-sm">
              <TransferDetail label="IBAN" value={iban} copyLabel="Copiar IBAN" />
              <TransferDetail
                label="Beneficiario"
                value={companyName ?? '—'}
                copyLabel="Copiar beneficiario"
              />
              <TransferDetail label="Concepto" value={transferConcept} copyLabel="Copiar concepto" />
              <TransferDetail label="Importe" value={formatEUR(amountDue)} />
            </dl>

            <CopyButton
              text={transferCopyText}
              label="Copiar todos los datos de la transferencia"
              successMessage="Datos de la transferencia copiados"
              showLabel
              className="mt-5 border border-zinc-200 dark:border-zinc-700"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function TransferDetail({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel?: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
        <span className={label === 'IBAN' ? 'truncate font-mono' : 'truncate'}>{value}</span>
        {copyLabel ? <CopyButton text={value} label={copyLabel} /> : null}
      </dd>
    </div>
  )
}