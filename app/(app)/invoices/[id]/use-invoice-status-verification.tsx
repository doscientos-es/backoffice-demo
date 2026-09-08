'use client'

import { useState } from 'react'

import { MfaChallengeDialog } from '@/components/security/mfa-challenge-dialog'
import { usePasskeyVerification } from '@/components/security/use-passkey-verification'
import { userVerificationScope } from '@/lib/security/user-verification-scope'
import { getBrowserClient } from '@/lib/supabase/browser'

import type { InvoiceFeedback, InvoiceStatusChange } from './invoice-action-contracts'

/** Keeps the MFA challenge and passkey verification out of individual action controls. */
export function useInvoiceStatusVerification(invoiceId: string, feedback: InvoiceFeedback) {
  const [mfaOpen, setMfaOpen] = useState(false)
  const [resolver, setResolver] = useState<((verified: boolean) => void) | null>(null)
  const { challenge: passkeyChallenge, verifyWithPasskey } = usePasskeyVerification()

  const ensureAal2 = async (): Promise<boolean> => {
    const { data, error } = await getBrowserClient().auth.mfa.getAuthenticatorAssuranceLevel()
    if (!error && data?.currentLevel === 'aal2') return true
    return new Promise((resolve) => {
      setResolver(() => resolve)
      setMfaOpen(true)
    })
  }

  const verifyStatusChange = async (status: InvoiceStatusChange): Promise<boolean> => {
    if (status === 'paid') return true
    if (!(await ensureAal2())) return false
    const verification = await verifyWithPasskey(
      userVerificationScope('invoice.status.update', `invoice:${invoiceId}:status:${status}`),
    )
    if (verification.ok) return true
    feedback.setError(verification.error)
    return false
  }

  const challenge = (
    <>
      {passkeyChallenge}
      <MfaChallengeDialog
        open={mfaOpen}
        onOpenChange={(open) => {
          setMfaOpen(open)
          if (!open) {
            resolver?.(false)
            setResolver(null)
          }
        }}
        onVerified={() => {
          setMfaOpen(false)
          resolver?.(true)
          setResolver(null)
        }}
      />
    </>
  )

  return { challenge, verifyStatusChange }
}
