import { PageHeader } from '@/components/layout/page-header'
import { MfaTotpCard } from '@/components/security/mfa-totp-card'
import { PasskeyStatusCard } from '@/components/security/passkey-status-card'
import { requireUser } from '@/lib/auth'
import { hasRegisteredPasskey } from '@/lib/security/webauthn'
import { createServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Seguridad · Ajustes · doscientos' }
export const dynamic = 'force-dynamic'

export default async function SecuritySettingsPage() {
  const user = await requireUser()
  const supabase = await createServerClient()
  const [passkeyConfigured, settingsResult] = await Promise.all([
    hasRegisteredPasskey(user.id),
    supabase.from('settings').select('vault_password_hash').eq('id', 1).single(),
  ])
  const required = user.role === 'owner' || user.role === 'admin'
  const vaultPasswordSet = Boolean(
    (settingsResult.data as { vault_password_hash: string | null } | null)?.vault_password_hash,
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Seguridad"
        description="Gestiona los factores que protegen tu cuenta y las acciones sensibles."
      />
      <MfaTotpCard required={required} />
      <PasskeyStatusCard configured={passkeyConfigured} vaultPasswordSet={vaultPasswordSet} />
    </div>
  )
}
