'use client'

import { Eye, EyeOff, Fingerprint } from 'lucide-react'
import { useState } from 'react'

import { usePasskeyVerification } from '@/components/security/use-passkey-verification'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { userVerificationScope } from '@/lib/security/user-verification-scope'
import { cn } from '@/lib/utils'

import { setVaultPassword, unlockVault, unlockVaultWithPasskey } from '../actions'

// ── Password strength ─────────────────────────────────────────────────────────
type StrengthLevel = 0 | 1 | 2 | 3 | 4

function getStrength(pw: string): StrengthLevel {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw)) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  // Map 0-5 → 0-4 (4 = all requirements met)
  return Math.min(4, score) as StrengthLevel
}

const STRENGTH_META: Record<StrengthLevel, { label: string; color: string }> = {
  0: { label: '', color: '' },
  1: { label: 'Muy débil', color: 'bg-destructive' },
  2: { label: 'Débil', color: 'bg-orange-500' },
  3: { label: 'Aceptable', color: 'bg-yellow-500' },
  4: { label: 'Fuerte', color: 'bg-emerald-500' },
}

function PasswordStrengthBar({ password }: { password: string }) {
  const level = getStrength(password)
  if (!password) return null
  const { label, color } = STRENGTH_META[level]
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {([1, 2, 3, 4] as const).map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              level >= i ? color : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          'text-xs',
          level === 4 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
        )}
      >
        {label}
        {level < 4 && ' — necesita minúsculas, mayúsculas, números y símbolos'}
      </p>
    </div>
  )
}

/** Dialog body: unlock the vault with master password */
export function UnlockForm({
  passkeyConfigured = false,
  onClose,
  onSuccess,
}: {
  passkeyConfigured?: boolean
  onClose: () => void
  /** Called after a successful unlock instead of reloading the page. */
  onSuccess?: () => void
}) {
  const feedback = useFormFeedback()
  const [showPassword, setShowPassword] = useState(false)
  const { challenge, verifyWithPasskey } = usePasskeyVerification()

  async function handlePasskeyUnlock() {
    feedback.setPending()
    const verification = await verifyWithPasskey(userVerificationScope('vault.unlock', 'vault'))
    if (!verification.ok) {
      feedback.setError(verification.error)
      return
    }
    const result = await unlockVaultWithPasskey()
    if (!result.ok) {
      feedback.setError(result.error)
      return
    }
    feedback.setSuccess('Bóveda desbloqueada')
    setTimeout(() => {
      onClose()
      if (onSuccess) onSuccess()
      else window.location.reload()
    }, 500)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()
    const result = await unlockVault(fd)
    if (result.ok) {
      feedback.setSuccess('Bóveda desbloqueada')
      setTimeout(() => {
        onClose()
        if (onSuccess) onSuccess()
        else window.location.reload()
      }, 500)
    } else {
      feedback.setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="unlock-pw">Contraseña maestra</FieldLabel>
        <div className="relative">
          <Input
            id="unlock-pw"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoFocus
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <div className="border-border flex flex-col gap-2 border-t pt-3">
        {feedback.state.status !== 'idle' ? (
          <FormFeedback state={feedback.state} successLabel="Desbloqueada" className="w-full" />
        ) : null}
        <div className={passkeyConfigured ? 'grid grid-cols-2 gap-2' : 'flex justify-end'}>
          {passkeyConfigured ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={feedback.pending}
              onClick={handlePasskeyUnlock}
              className="w-full"
            >
              <Fingerprint className="size-4" /> Usar biometría
            </Button>
          ) : null}
          <SubmitButton
            size="lg"
            className={passkeyConfigured ? 'w-full' : undefined}
            loading={feedback.pending}
            pendingLabel="Verificando…"
          >
            Desbloquear
          </SubmitButton>
        </div>
      </div>
      {challenge}
    </form>
  )
}

/** Dialog body: set / change master password */
export function SetPasswordForm({
  hasPassword,
  onClose,
}: {
  hasPassword: boolean
  onClose: () => void
}) {
  const feedback = useFormFeedback()
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const pw = fd.get('password') as string
    const confirm = fd.get('confirm') as string
    if (pw !== confirm) {
      feedback.setError('Las contraseñas no coinciden')
      return
    }
    feedback.setPending()
    const result = await setVaultPassword(fd)
    if (result.ok) {
      feedback.setSuccess('Contraseña guardada')
      setTimeout(() => {
        onClose()
        window.location.reload()
      }, 600)
    } else {
      feedback.setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {hasPassword && (
        <Field>
          <FieldLabel htmlFor="sp-current">Contraseña actual</FieldLabel>
          <Input
            id="sp-current"
            name="current_password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
          />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="sp-new">
          {hasPassword ? 'Nueva contraseña' : 'Contraseña maestra'}{' '}
          <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="sp-new"
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus={!hasPassword}
          autoComplete="new-password"
          placeholder="Aa1! Mín. 8 caracteres con símbolos"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthBar password={password} />
      </Field>
      <Field>
        <FieldLabel htmlFor="sp-confirm">
          Confirmar contraseña <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="sp-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <div className="border-border flex items-center justify-end gap-2 border-t pt-3">
        <FormFeedback state={feedback.state} successLabel="Guardada" />
        <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
          {hasPassword ? 'Cambiar contraseña' : 'Activar bóveda'}
        </SubmitButton>
      </div>
    </form>
  )
}
