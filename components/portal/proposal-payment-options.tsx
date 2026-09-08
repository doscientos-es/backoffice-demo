'use client'

import { CreditCard, Landmark } from 'lucide-react'

import { CopyButton } from '@/components/ui/copy-button'
import { formatEUR } from '@/lib/utils'

import { ProposalPaymentButton } from './proposal-payment-button'

interface ProposalPaymentOptionsProps {
  proposalId: string
  token: string
  proposalNumber: string
  initialPaymentPercentage: number
  depositAmount: number
  companyName: string | null
  iban: string | null
}

/** Offers the agreed first payment through the gateway or a bank transfer. */
export function ProposalPaymentOptions({
  proposalId,
  token,
  proposalNumber,
  initialPaymentPercentage,
  depositAmount,
  companyName,
  iban,
}: ProposalPaymentOptionsProps) {
  const transferConcept = `Propuesta ${proposalNumber}`
  const transferCopyText = [
    `Beneficiario: ${companyName ?? '—'}`,
    `IBAN: ${iban ?? '—'}`,
    `Concepto: ${transferConcept}`,
    `Importe del primer plazo: ${formatEUR(depositAmount)}`,
  ].join('\n')

  return (
    <section aria-labelledby="proposal-payment-options-title" className="w-full max-w-2xl">
      <div className="mb-4 space-y-1 text-center">
        <h2
          id="proposal-payment-options-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Realiza el primer pago
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Para poner en marcha el proyecto, abona el primer plazo acordado ({initialPaymentPercentage}{' '}
          %) de <strong className="text-zinc-900 tabular-nums dark:text-zinc-100">{formatEUR(depositAmount)}</strong>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-zinc-900 p-5 text-left shadow-sm ring-1 ring-zinc-800 dark:bg-zinc-800">
          <div className="mb-4 flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
            <div>
              <h3 className="font-semibold text-white">Tarjeta o Bizum</h3>
              <p className="mt-1 text-sm text-zinc-400">Pago seguro mediante nuestra pasarela integrada.</p>
            </div>
          </div>
          <ProposalPaymentButton
            proposalId={proposalId}
            token={token}
            depositAmount={depositAmount}
            paymentLabel="Pagar primer plazo"
          />
        </div>

        {iban ? (
          <div className="rounded-xl bg-white p-5 text-left shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="mb-4 flex items-start gap-3">
              <Landmark className="mt-0.5 size-5 shrink-0 text-zinc-700 dark:text-zinc-300" aria-hidden />
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Transferencia bancaria</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  También puede pagar este plazo antes de recibir la factura.
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
              <TransferDetail label="Importe" value={formatEUR(depositAmount)} />
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