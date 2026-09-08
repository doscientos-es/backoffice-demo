'use client'

import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SubmitButton } from '@/components/ui/submit-button'
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'
import { useFormDirty } from '@/lib/hooks/use-form-dirty'
import type { MemberOption } from '@/lib/members/queries'

import { updateLead } from '../actions'
import { LeadFormFields } from '../lead-form-fields'

type Lead = {
  id: string
  name: string
  alias: string | null
  company: string | null
  email: string | null
  phone: string | null
  source: string | null
  notes: string | null
  estimated_value: number | null
  company_size: string | null
  solution_type: string | null
  urgency: string | null
  assigned_to: string | null
  version: number
}

export function LeadEditDialog({ lead, members = [] }: { lead: Lead; members?: MemberOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const estimatedRaw = fd.get('estimated_value')?.toString() ?? ''
    const payload = {
      id: lead.id,
      expected_version: lead.version,
      name: fd.get('name')?.toString() ?? '',
      alias: fd.get('alias')?.toString() ?? '',
      email: fd.get('email')?.toString() ?? '',
      phone: fd.get('phone')?.toString() ?? '',
      company: fd.get('company')?.toString() ?? '',
      source: fd.get('source')?.toString() ?? '',
      notes: fd.get('notes')?.toString() ?? '',
      estimated_value: estimatedRaw === '' ? null : Number(estimatedRaw),
      company_size: fd.get('company_size')?.toString() ?? '',
      solution_type: fd.get('solution_type')?.toString() ?? '',
      urgency: fd.get('urgency')?.toString() ?? '',
      assigned_to: fd.get('assigned_to')?.toString() ?? '',
    }
    const res = await updateLead(payload)
    if (!res.ok) {
      if (res.code === 'conflict') setConflictOpen(true)
      else sileo.error({ title: res.error ?? 'No se pudo guardar el lead' })
      return
    }
    reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar lead</DialogTitle>
          <DialogDescription>Actualiza los datos del lead.</DialogDescription>
        </DialogHeader>
        <form
          key={lead.version}
          ref={formRef}
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="scroll-fade no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto pr-1">
            <LeadFormFields
              idPrefix={`edit-${lead.id}`}
              includeEstimatedValue
              members={members}
              defaults={{
                name: lead.name,
                alias: lead.alias,
                company: lead.company,
                email: lead.email,
                phone: lead.phone,
                source: lead.source,
                notes: lead.notes,
                estimated_value: lead.estimated_value,
                company_size: lead.company_size,
                solution_type: lead.solution_type,
                urgency: lead.urgency,
                assigned_to: lead.assigned_to,
              }}
            />
          </div>
          <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t pt-3">
            <SubmitButton isDisabled={!isDirty}>Guardar cambios</SubmitButton>
          </div>
        </form>
      </DialogContent>
      <VersionConflictDialog
        open={conflictOpen}
        entityName="lead"
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
