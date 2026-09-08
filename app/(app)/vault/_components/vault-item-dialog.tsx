'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { VAULT_SERVICE_LABELS, VAULT_SERVICES } from '@/lib/schemas/vault'

import { createVaultItem, updateVaultItem } from '../actions'

type Client = { id: string; name: string }
type VaultItem = {
  id: string
  name: string
  service: string
  username: string | null
  notes: string | null
  is_sensitive: boolean
  expires_at: string | null
  client_id: string | null
}

interface Props {
  item?: VaultItem
  clients: Client[]
  onClose: () => void
}

export function VaultItemForm({ item, clients, onClose }: Props) {
  const feedback = useFormFeedback()
  const [showSecret, setShowSecret] = useState(false)
  const isEdit = !!item

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()
    const action = isEdit ? updateVaultItem : createVaultItem
    const result = await action(fd)
    if (result.ok) {
      feedback.setSuccess(isEdit ? 'Guardado' : 'Credencial añadida')
      setTimeout(onClose, 600)
    } else {
      feedback.setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="vi-name">
            Nombre <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="vi-name"
            name="name"
            required
            defaultValue={item?.name}
            placeholder="FTP Hostinger"
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="vi-service">Servicio</FieldLabel>
          <Select id="vi-service" name="service" defaultValue={item?.service ?? 'other'}>
            {VAULT_SERVICES.map((s) => (
              <option key={s} value={s}>
                {VAULT_SERVICE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="vi-username">Usuario / Email</FieldLabel>
          <Input
            id="vi-username"
            name="username"
            defaultValue={item?.username ?? ''}
            placeholder="admin@dominio.com"
            autoComplete="off"
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="vi-secret">
            {isEdit ? 'Secreto (vacío = no cambiar)' : 'Secreto / Contraseña'}{' '}
            {!isEdit && <span className="text-destructive">*</span>}
          </FieldLabel>
          <div className="relative">
            <Input
              id="vi-secret"
              name="secret"
              type={showSecret ? 'text' : 'password'}
              required={!isEdit}
              placeholder={isEdit ? '••••••••' : 'Contraseña, token, clave…'}
              autoComplete="new-password"
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
              aria-label={showSecret ? 'Ocultar' : 'Mostrar'}
            >
              {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="vi-expires">Caduca</FieldLabel>
          <Input
            id="vi-expires"
            name="expires_at"
            type="date"
            defaultValue={item?.expires_at ?? ''}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="vi-client">Cliente (opcional)</FieldLabel>
          <Select id="vi-client" name="client_id" defaultValue={item?.client_id ?? ''}>
            <option value="">— Sin cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="vi-notes">Notas</FieldLabel>
          <Textarea
            id="vi-notes"
            name="notes"
            rows={2}
            defaultValue={item?.notes ?? ''}
            placeholder="Notas adicionales…"
          />
        </Field>
        <Field className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="hidden" name="is_sensitive" value="false" />
            <input
              type="checkbox"
              name="is_sensitive"
              value="true"
              defaultChecked={item ? item.is_sensitive : true}
              className="border-border accent-primary h-4 w-4 rounded"
            />
            <span>Sensible — requiere contraseña maestra para ver o editar</span>
          </label>
          <FieldDescription>Marca los tokens y contraseñas críticas.</FieldDescription>
        </Field>
      </div>
      <div className="border-border flex items-center justify-end gap-2 border-t pt-3">
        <FormFeedback state={feedback.state} successLabel={isEdit ? 'Guardado' : 'Añadido'} />
        <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
          {isEdit ? 'Guardar cambios' : 'Añadir credencial'}
        </SubmitButton>
      </div>
    </form>
  )
}
