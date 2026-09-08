'use client'

import { useRef } from 'react'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import type { MemberRole } from '@/lib/auth'

import { inviteTeamMember } from './actions'

interface Props {
  actorRole: MemberRole
}

export function InviteForm({ actorRole }: Props) {
  const feedback = useFormFeedback()
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()
    try {
      const result = await inviteTeamMember(fd)
      if (result.ok) {
        feedback.setSuccess('Invitación enviada')
        formRef.current?.reset()
      } else {
        feedback.setError(result.error || 'No se pudo enviar la invitación.')
      }
    } catch (err) {
      feedback.setError(err instanceof Error ? err.message : 'Error inesperado al invitar.')
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
        <Field>
          <FieldLabel htmlFor="invite_name" className="text-xs font-medium">
            Nombre <span className="text-muted-foreground font-normal">(opcional)</span>
          </FieldLabel>
          <Input
            id="invite_name"
            name="name"
            placeholder="Se completa en el onboarding"
            autoComplete="name"
            maxLength={120}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite_email" className="text-xs font-medium">
            Email <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="invite_email"
            name="email"
            type="email"
            inputMode="email"
            required
            placeholder="nombre@gmail.com"
            autoComplete="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite_role" className="text-xs font-medium">
            Rol <span className="text-destructive">*</span>
          </FieldLabel>
          <Select id="invite_role" name="role" defaultValue="member">
            {actorRole === 'owner' ? <option value="owner">Propietario</option> : null}
            <option value="admin">Administrador</option>
            <option value="member">Miembro</option>
            <option value="viewer">Solo lectura</option>
          </Select>
        </Field>
      </div>
      <FieldDescription>
        El invitado recibirá un enlace para activar su cuenta y, a partir de ahí, entrará con{' '}
        <strong>Continuar con Google</strong>. Caduca a las 72&nbsp;horas.
      </FieldDescription>
      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <FormFeedback
          state={feedback.state}
          pendingLabel="Enviando…"
          successLabel="Invitación enviada"
        />
        <SubmitButton pendingLabel="Enviando…" loading={feedback.pending}>
          Enviar invitación
        </SubmitButton>
      </div>
    </form>
  )
}
