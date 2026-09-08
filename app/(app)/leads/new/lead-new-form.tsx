'use client'

import { ClipboardPaste } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { parseLeadClipboard } from '@/lib/leads/clipboard'

import { createLead } from '../actions'
import { type LeadFormDefaults, LeadFormFields } from '../lead-form-fields'

/**
 * Standalone lead-creation form for `/leads/new`.
 */
export function LeadNewForm({
  defaults,
  shared = false,
}: {
  defaults?: LeadFormDefaults
  shared?: boolean
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const formRef = useRef<HTMLFormElement>(null)

  async function pasteFromClipboard() {
    try {
      const captured = parseLeadClipboard(await navigator.clipboard.readText())
      if (!captured.notes) return sileo.info({ title: 'El portapapeles está vacío' })
      const form = formRef.current
      if (!form) return
      const setIfEmpty = (name: 'email' | 'phone', value: string | undefined) => {
        const field = form.elements.namedItem(name)
        if (value && field instanceof HTMLInputElement && !field.value) field.value = value
      }
      setIfEmpty('email', captured.email)
      setIfEmpty('phone', captured.phone)
      const notes = form.elements.namedItem('notes')
      if (notes instanceof HTMLTextAreaElement) {
        notes.value = [notes.value, captured.notes].filter(Boolean).join(notes.value ? '\n\n' : '')
      }
      sileo.success({ title: 'Contenido añadido al nuevo lead' })
    } catch {
      sileo.error({ title: 'No se pudo leer el portapapeles' })
    }
  }

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
    router.push(`/leads/${res.id}`)
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      {shared ? (
        <p className="border-primary/20 bg-primary/5 text-muted-foreground rounded-md border px-3 py-2 text-sm">
          Contenido compartido importado. Revisa los datos antes de crear el lead.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => void pasteFromClipboard()}>
          <ClipboardPaste className="size-3.5" />
          Pegar desde portapapeles
        </Button>
      </div>
      <LeadFormFields defaults={defaults} idPrefix="new" includeEstimatedValue autoFocusName />
      <div className="border-border flex items-center justify-end gap-3 border-t pt-5">
        <FormFeedback state={feedback.state} pendingLabel="Creando…" />
        <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
          Crear lead
        </SubmitButton>
      </div>
    </form>
  )
}
