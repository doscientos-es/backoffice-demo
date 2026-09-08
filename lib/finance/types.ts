import type {
  ExpenseCategory,
  ExpensePaymentSource,
  ExpenseRecurrence,
  ExpenseStatus,
} from './helpers'

export const EXPENSE_LIST_PAGE_SIZE = 25

export type MemberContribution = {
  memberId: string
  memberName: string
  total: number
}

export type FinanceKpis = {
  revenueMonth: number
  expenseMonth: number
  netMonth: number
  margin: number | null
  // Real cash collected via the payment gateway within the range.
  cashCollected: number
  // All-time outstanding amount on issued/overdue invoices (total minus confirmed payments).
  pendingCollection: number
}

export type FinanceDetails = {
  topCategories: [ExpenseCategory, number][]
  recentExpenses: ExpenseListItem[]
  recentInvoices: InvoiceRow[]
  memberContributions: MemberContribution[]
}

export type InvoiceRow = {
  id: string
  full_number: string | null
  total: number
  issue_date: string
  client_name: string | null
}

export type ExpenseListItem = {
  id: string
  /** Internal optimistic-concurrency token. */
  version: number
  vendor: string
  category: ExpenseCategory
  status: ExpenseStatus
  total: number
  expense_date: string
  recurrence: ExpenseRecurrence
  // Editable payload so the list can open the edit dialog and duplicate
  // without an extra round-trip per row.
  description: string | null
  due_date: string | null
  paid_at: string | null
  currency: string
  subtotal: number
  tax_rate: number
  vendor_nif: string | null
  invoice_reference: string | null
  project_id: string | null
  notes: string | null
  payment_source: ExpensePaymentSource
  paid_by_member_id: string | null
}

/**
 * A previously used vendor with its most recent fiscal data, used to power
 * the vendor/NIF autocomplete in the expense form.
 */
export type VendorSuggestion = {
  vendor: string
  vendor_nif: string | null
  category: ExpenseCategory
  payment_source: ExpensePaymentSource
}

export type ExpenseListParams = {
  year: string | null
  category: ExpenseCategory | null
  status: ExpenseStatus | null
  q: string
  page: number
}

export type ExpenseListResult = {
  expenses: ExpenseListItem[]
  count: number
  total: number
  years: string[]
  error: string | null
}

export type ExpenseProjectOption = {
  id: string
  name: string
  clientName: string | null
}

export type ExpenseDetailProject = {
  id: string
  name: string
  clientName: string | null
}

export type ExpenseDetail = {
  id: string
  /** Internal optimistic-concurrency token. */
  version: number
  vendor: string
  description: string | null
  category: ExpenseCategory
  status: ExpenseStatus
  recurrence: ExpenseRecurrence
  expense_date: string
  due_date: string | null
  paid_at: string | null
  currency: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  vendor_nif: string | null
  invoice_reference: string | null
  project_id: string | null
  notes: string | null
  payment_source: ExpensePaymentSource
  paid_by_member_id: string | null
  paid_by_member_name: string | null
  project: ExpenseDetailProject | null
}

export type ExpenseDetailResult = {
  expense: ExpenseDetail
  projectOptions: ExpenseProjectOption[]
}
