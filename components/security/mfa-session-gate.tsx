'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { MemberRole } from '@/lib/auth'
import { getBrowserClient } from '@/lib/supabase/browser'

import { MfaChallengeDialog } from './mfa-challenge-dialog'

type Props = { memberRole: MemberRole; mfaVerified: boolean }

/** Challenges administrative sessions in-place before they use protected areas. */
export function MfaSessionGate({ memberRole, mfaVerified }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [verifiedPath, setVerifiedPath] = useState<string | null>(mfaVerified ? pathname : null)
  const requiresMfa =
    (memberRole === 'owner' || memberRole === 'admin') && pathname !== '/settings/security'
  const open = requiresMfa && verifiedPath !== pathname

  useEffect(() => {
    if (!requiresMfa) {
      setVerifiedPath(pathname)
      return
    }

    let active = true
    void getBrowserClient()
      .auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data, error }) => {
        if (!active) return
        setVerifiedPath(!error && data?.currentLevel === 'aal2' ? pathname : null)
      })

    return () => {
      active = false
    }
  }, [pathname, requiresMfa])

  return (
    <MfaChallengeDialog
      open={open}
      onOpenChange={() => undefined}
      onVerified={() => {
        setVerifiedPath(pathname)
        router.refresh()
      }}
      dismissible={false}
      setupHref="/settings/security"
    />
  )
}
