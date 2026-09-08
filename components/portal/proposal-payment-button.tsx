'use client'

import { CreditCard, LoaderCircle as Loader2 } from 'lucide-react'
import { useTransition } from 'react'

import { initiateProposalPayment } from '@/app/p/proposal/[token]/actions'
import { Button } from '@/components/ui/button'
import { formatEUR } from '@/lib/utils'

interface ProposalPaymentButtonProps {
  proposalId: string
  token: string
  depositAmount: number
  paymentLabel: string
}

export function ProposalPaymentButton({
  proposalId,
  token,
  depositAmount,
  paymentLabel,
}: ProposalPaymentButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handlePay = () => {
    startTransition(async () => {
      const result = await initiateProposalPayment(proposalId, token)
      if (!result.ok) {
        window.location.href = `/p/proposal/${token}?error=1`
        return
      }
      // Dynamically build and submit the Redsys form
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = result.url
      form.style.display = 'none'
      for (const [name, value] of Object.entries({
        Ds_SignatureVersion: result.signatureVersion,
        Ds_MerchantParameters: result.merchantParameters,
        Ds_Signature: result.signature,
      })) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
    })
  }

  return (
    <Button
      type="button"
      onClick={handlePay}
      disabled={isPending}
      size="lg"
      className="w-full font-semibold sm:w-auto"
    >
      {isPending ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-5 w-5" />
      )}
      {isPending ? 'Preparando pago…' : `${paymentLabel} (${formatEUR(depositAmount)})`}
    </Button>
  )
}
