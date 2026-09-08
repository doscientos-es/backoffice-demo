'use client'

import { Eye, EyeOff, Key as KeyRound, LockOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'

type UpdateAction = (input: unknown) => Promise<{ ok: true } | { ok: false; error: string }>

/**
 * Admin controls for a proposal/invoice public link: the `is_client_visible`
 * toggle and the optional password gate. Resource-agnostic — the caller injects
 * the matching `update*PortalAccess` server action.
 */
export function PortalAccessControls({
  id,
  initialVisible,
  hasPassword,
  action,
  visibilityAction,
}: {
  id: string
  initialVisible: boolean
  hasPassword: boolean
  action: UpdateAction
  visibilityAction?: React.ReactNode
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [password, setPassword] = useState('')

  async function run(input: Record<string, unknown>, ok: string) {
    feedback.setPending()
    const res = await action({ id, ...input })
    if (res.ok) {
      feedback.setSuccess(ok)
      startTransition(() => router.refresh())
      return true
    }
    feedback.setError(res.error)
    return false
  }

  async function handleSavePassword() {
    if (!password.trim()) {
      feedback.setError('Introduce una contraseña')
      return
    }
    if (await run({ password }, 'Contraseña guardada')) {
      setPassword('')
      setEditing(false)
    }
  }

  return (
    <div className="border-border/60 flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm leading-tight font-medium">Visibilidad</span>
          <Badge variant={initialVisible ? 'success' : 'neutral'}>
            {initialVisible ? 'Visible para el cliente' : 'Oculta'}
          </Badge>
        </div>
        {visibilityAction ?? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              run({ is_client_visible: !initialVisible }, initialVisible ? 'Oculta' : 'Visible')
            }
          >
            {initialVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {initialVisible ? 'Ocultar' : 'Mostrar'}
          </Button>
        )}
      </div>

      <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm leading-tight font-medium">Contraseña</span>
          <Badge variant={hasPassword ? 'info' : 'neutral'}>
            {hasPassword ? 'Protegida' : 'Sin contraseña'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {hasPassword ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => run({ password: null }, 'Contraseña eliminada')}
            >
              <LockOpen className="size-3.5" />
              Quitar
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            <KeyRound className="size-3.5" />
            {hasPassword ? 'Cambiar' : 'Establecer'}
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña"
            autoComplete="new-password"
          />
          <Button type="button" size="sm" onClick={handleSavePassword} disabled={feedback.pending}>
            Guardar
          </Button>
        </div>
      ) : null}

      <FormFeedback state={feedback.state} className="self-end" />
    </div>
  )
}
