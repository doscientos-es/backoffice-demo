'use client'

import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'
import { useFormDirty } from '@/lib/hooks/use-form-dirty'

import { updateClient } from '../actions'
import { ClientFormFields } from '../client-form-fields'

type Client = {
  id: string
  name: string
  label: string | null
  nif: string | null
  email: string | null
  phone: string | null
  contact_person: string | null
  billing_address_street: string | null
  billing_address_zip: string | null
  billing_address_city: string | null
  billing_address_province: string | null
  billing_address_country: string | null
  notes: string | null
  logo_url: string | null
  version: number
}

export function ClientEditDialog({
  client,
  trigger,
}: {
  client: Client
  /** Custom trigger element. Defaults to the standard "Editar" button. */
  trigger?: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const feedback = useFormFeedback()
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const fd = new FormData(e.currentTarget)
    const res = await updateClient({
      id: client.id,
      expected_version: client.version,
      name: fd.get('name')?.toString() ?? '',
      label: fd.get('label')?.toString() ?? '',
      nif: fd.get('nif')?.toString() ?? '',
      email: fd.get('email')?.toString() ?? '',
      phone: fd.get('phone')?.toString() ?? '',
      billing_address_street: fd.get('billing_address_street')?.toString() ?? '',
      billing_address_zip: fd.get('billing_address_zip')?.toString() ?? '',
      billing_address_city: fd.get('billing_address_city')?.toString() ?? '',
      billing_address_province: fd.get('billing_address_province')?.toString() ?? '',
      billing_address_country: fd.get('billing_address_country')?.toString() ?? 'ES',
      contact_person: fd.get('contact_person')?.toString() ?? '',
      notes: fd.get('notes')?.toString() ?? '',
      logo_url: fd.get('logo_url')?.toString() ?? '',
    })
    if (!res.ok) {
      if (res.code === 'conflict') setConflictOpen(true)
      else feedback.setError(res.error)
      return
    }
    feedback.setSuccess('Guardado')
    reset()
    setTimeout(() => {
      setOpen(false)
      router.refresh()
    }, 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) feedback.reset()
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Actualiza los datos del cliente.</DialogDescription>
        </DialogHeader>
        <form
          key={client.version}
          ref={formRef}
          onSubmit={onSubmit}
          className="flex max-h-[75svh] flex-col sm:max-h-[70vh]"
        >
          <div className="scroll-fade no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <ClientFormFields
              idPrefix={`edit-${client.id}`}
              defaults={{
                name: client.name,
                label: client.label,
                nif: client.nif,
                email: client.email,
                phone: client.phone,
                contact_person: client.contact_person,
                billing_address_street: client.billing_address_street,
                billing_address_zip: client.billing_address_zip,
                billing_address_city: client.billing_address_city,
                billing_address_province: client.billing_address_province,
                billing_address_country: client.billing_address_country,
                notes: client.notes,
                logo_url: client.logo_url,
              }}
            />
          </div>
          <div className="border-border bg-background/95 -mx-4 flex shrink-0 flex-col-reverse gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:bg-transparent sm:p-0 sm:pt-3 sm:backdrop-blur-none">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton
              className="min-h-11 w-full sm:w-auto"
              loading={feedback.pending}
              isDisabled={!isDirty}
              pendingLabel="Guardando…"
            >
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
      <VersionConflictDialog
        open={conflictOpen}
        entityName="cliente"
        onKeepEditing={() => setConflictOpen(false)}
        onReload={() => {
          setConflictOpen(false)
          setOpen(false)
          router.refresh()
        }}
      />
    </Dialog>
  )
}
