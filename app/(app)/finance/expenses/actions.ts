'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { defineAction } from '@/lib/actions/define-action'
import { VersionConflictError } from '@/lib/concurrency/version-conflict'
import { computeExpenseTotals } from '@/lib/finance'
import { uuidIdInput } from '@/lib/schemas/common'
import { ExpenseInput, type ExpenseInputType, UpdateExpenseInput } from '@/lib/schemas/expense'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Maps a validated expense input to the `expenses` table row shape, deriving
 * the monetary totals from subtotal + tax_rate. Shared by create and update.
 */
function buildExpenseDbPayload(input: ExpenseInputType) {
  const { subtotal, taxAmount, total } = computeExpenseTotals(input.subtotal, input.tax_rate)
  return {
    vendor: input.vendor,
    description: input.description ?? null,
    category: input.category,
    status: input.status,
    recurrence: input.recurrence,
    expense_date: input.expense_date,
    due_date: input.due_date ?? null,
    paid_at: input.paid_at ?? null,
    currency: input.currency,
    subtotal,
    tax_rate: input.tax_rate,
    tax_amount: taxAmount,
    total,
    vendor_nif: input.vendor_nif ?? null,
    invoice_reference: input.invoice_reference ?? null,
    project_id: input.project_id ?? null,
    notes: input.notes ?? null,
    payment_source: input.payment_source,
    paid_by_member_id: input.paid_by_member_id ?? null,
  }
}

export const createExpense = defineAction({
  name: 'expenses.create',
  schema: ExpenseInput,
  // Always redirects (or throws) — pin to `void` so the result type stays a
  // proper `ActionResult` union instead of distributing to `never`.
  handler: async (input, { user }): Promise<void> => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...buildExpenseDbPayload(input), created_by: user.id })
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el gasto')
    revalidatePath('/finance')
    revalidatePath('/finance/expenses')
    redirect(`/finance/expenses/${data.id}`)
  },
})

export const updateExpense = defineAction({
  name: 'expenses.update',
  schema: UpdateExpenseInput,
  revalidate: (_payload, input) => [
    `/finance/expenses/${input.id}`,
    '/finance/expenses',
    '/finance',
  ],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('expenses')
      .update(buildExpenseDbPayload(input))
      .eq('id', input.id)
      .eq('version', input.expected_version)
      .select('version')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new VersionConflictError()
    return { version: Number(data.version) }
  },
})

/**
 * Soft-deletes an expense and returns an `ActionResult` so the list view can
 * refresh in place (the kebab "Eliminar" action). `deleteExpense` below is the
 * redirect-based variant used by the detail page's danger zone.
 */
export const removeExpense = defineAction({
  name: 'expenses.remove',
  schema: uuidIdInput,
  roles: ['owner', 'admin'],
  revalidate: () => ['/finance/expenses', '/finance'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)

    if (error) throw new Error(error.message)
  },
})

const deleteExpenseAction = defineAction({
  name: 'expenses.delete',
  schema: uuidIdInput,
  roles: ['owner', 'admin'],
  handler: async (input): Promise<void> => {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)

    if (error) throw new Error(error.message)
    revalidatePath('/finance/expenses')
    revalidatePath('/finance')
    redirect('/finance/expenses')
  },
})

/**
 * Form-action wrapper for the detail page's danger zone. `<form action={…}>`
 * requires a `(FormData) => void` signature, so we discard the `ActionResult`:
 * the handler redirects on success and the hidden `id` makes validation
 * failure unreachable here.
 */
export async function deleteExpense(formData: FormData): Promise<void> {
  await deleteExpenseAction(formData)
}
