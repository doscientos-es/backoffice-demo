'use client'

import { Plus } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'

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

import { createLead } from './actions'
import { LeadFormFields } from './lead-form-fields'

interface Props {
  /** Custom trigger element. Defaults to a "Nuevo lead" button. */
  trigger?: ReactNode
  /** Callback fired after successful lead creation. */
  onCreated?: (id: string) => void
}

/**
 * Dialog for creating a new lead without navigating away.
 */
export function LeadCreateDialog({ trigger, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const feedback = useFormFeedback()
  const formRef = useRef<HTMLFormElement>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const fd = new FormData(e.currentTarget)
    const estimatedRaw = fd.get('estimated_value')?.toString() ?? ''
    const estimated_value = estimatedRaw === '' ? null : Number(estimatedRaw)

    const res = await createLead({
      name: fd.get('name')?.toString() ?? '',
      alias: fd.get('alias')?.toString() ?? '',
      company: fd.get('company')?.toString() ?? '',
      email: fd.get('email')?.toString() ?? '',
      phone: fd.get('phone')?.toString() ?? '',
      source: fd.get('source')?.toString() ?? '',
      notes: fd.get('notes')?.toString() ?? '',
      estimated_value,
      company_size: fd.get('company_size')?.toString() ?? '',
      solution_type: fd.get('solution_type')?.toString() ?? '',
      urgency: fd.get('urgency')?.toString() ?? '',
    })

    if (!res.ok) return feedback.setError(res.error)

    feedback.setSuccess('Lead creado')
    formRef.current?.reset()
    onCreated?.(res.id)
    setTimeout(() => setOpen(false), 400)
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
          <Button size="sm">
            <Plus className="size-4" aria-hidden />
            Nuevo lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>
            Registra una nueva oportunidad. Se te asignará y tendrá seguimiento hoy.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="scroll-fade no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <LeadFormFields idPrefix="create" includeEstimatedValue autoFocusName />
          </div>
          <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Creando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
              Crear lead
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
