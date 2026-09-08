'use client'

import { Button } from '@/components/ui/button'
import type { VendorSuggestion } from '@/lib/finance/types'
import { useActionForm } from '@/lib/hooks/use-action-form'

import { createExpense } from '../actions'
import { type ExpenseFormDefaults, ExpenseFormFields } from '../expense-form-fields'

interface Props {
  projects: Array<{ id: string; name: string; clientName?: string | null }>
  teamMembers: Array<{ id: string; name: string }>
  defaults?: ExpenseFormDefaults
  vendorSuggestions?: VendorSuggestion[]
}

export function NewExpenseForm({ projects, teamMembers, defaults, vendorSuggestions }: Props) {
  // createExpense redirects on success, so we only ever surface its error.
  const { state, pending, onSubmit } = useActionForm(createExpense)
  const error = state.status === 'error' ? state.message : null

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <ExpenseFormFields
        autoFocusVendor
        projects={projects}
        teamMembers={teamMembers}
        defaults={defaults}
        vendorSuggestions={vendorSuggestions}
      />
      {error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="border-border flex justify-end border-t pt-4">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Creando…' : 'Crear gasto'}
        </Button>
      </div>
    </form>
  )
}
