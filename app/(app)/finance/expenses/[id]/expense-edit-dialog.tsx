'use client'

import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'
import { useActionForm } from '@/lib/hooks/use-action-form'
import { useFormDirty } from '@/lib/hooks/use-form-dirty'

import { updateExpense } from '../actions'
import { ExpenseFormFields, type VendorSuggestion } from '../expense-form-fields'

type Expense = {
  id: string
  vendor: string
  description: string | null
  category: string
  status: string
  recurrence: string
  expense_date: string
  due_date: string | null
  paid_at: string | null
  currency: string
  subtotal: number | string
  tax_rate: number | string
  vendor_nif: string | null
  invoice_reference: string | null
  project_id: string | null
  notes: string | null
  payment_source?: string | null
  paid_by_member_id?: string | null
  version: number
}

interface Props {
  expense: Expense
  projects: Array<{ id: string; name: string; clientName?: string | null }>
  teamMembers?: Array<{ id: string; name: string }>
  vendorSuggestions?: VendorSuggestion[]
  /** Controlled open state (used when triggered from the list kebab menu). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hide the built-in "Editar" trigger when opened externally. */
  hideTrigger?: boolean
}

export function ExpenseEditDialog({
  expense,
  projects,
  teamMembers = [],
  vendorSuggestions = [],
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }
  const { formRef, isDirty, markDirty, reset: resetDirty } = useFormDirty<HTMLFormElement>()
  const {
    state,
    pending,
    onSubmit,
    reset: resetFeedback,
  } = useActionForm(updateExpense, {
    successMessage: 'Guardado',
    onSuccess: () => {
      resetDirty()
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 400)
    },
    onFailure: (result) => {
      if (result.code !== 'conflict') return false
      setConflictOpen(true)
      return true
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetFeedback()
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar gasto</DialogTitle>
          <DialogDescription>Actualiza los datos del gasto.</DialogDescription>
        </DialogHeader>
        <form
          key={expense.version}
          ref={formRef}
          onSubmit={onSubmit}
          className="flex max-h-[70vh] flex-col"
        >
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="expected_version" value={expense.version} />
          <div className="scroll-fade no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <ExpenseFormFields
              idPrefix={`edit-${expense.id}`}
              projects={projects}
              teamMembers={teamMembers}
              vendorSuggestions={vendorSuggestions}
              onProjectIdChange={markDirty}
              defaults={{
                vendor: expense.vendor,
                description: expense.description,
                category: expense.category,
                status: expense.status,
                recurrence: expense.recurrence,
                expense_date: expense.expense_date.slice(0, 10),
                due_date: expense.due_date?.slice(0, 10) ?? '',
                paid_at: expense.paid_at?.slice(0, 10) ?? '',
                currency: expense.currency,
                subtotal: Number(expense.subtotal ?? 0),
                tax_rate: Number(expense.tax_rate ?? 0),
                vendor_nif: expense.vendor_nif,
                invoice_reference: expense.invoice_reference,
                project_id: expense.project_id,
                notes: expense.notes,
                payment_source: expense.payment_source,
                paid_by_member_id: expense.paid_by_member_id,
              }}
            />
          </div>
          <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t pt-3">
            <FormFeedback state={state} pendingLabel="Guardando…" />
            <SubmitButton loading={pending} isDisabled={!isDirty} pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
      <VersionConflictDialog
        open={conflictOpen}
        entityName="gasto"
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
