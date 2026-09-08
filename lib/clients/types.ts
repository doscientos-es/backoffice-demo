/**
 * Shared types and constants for the clients domain.
 */

import type { ReminderRow } from '@/lib/dashboard/types'

export const CLIENT_LIST_PAGE_SIZE = 25
export const CLIENT_PROJECTS_LIMIT = 20
export const CLIENT_RELATED_LIMIT = 10

export type FiscalVerificationStatus =
  | 'unverified'
  | 'verified'
  | 'mismatch'
  | 'unavailable'
  | 'invalid'
  | 'not_applicable'

// ─── List ─────────────────────────────────────────────────────────────────────

export type ClientListItem = {
  id: string
  /** Internal optimistic-concurrency token. */
  version: number
  name: string
  /** Optional short display name. Falls back to `name` when null. */
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
  updated_at: string | null
}

export const CLIENT_SORT_COLUMNS = ['name', 'nif', 'email', 'created_at'] as const

export type ClientListParams = {
  q?: string
  page?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type ClientListResult = {
  data: ClientListItem[]
  count: number
}

// ─── Detail (related rows) ────────────────────────────────────────────────────

export type ClientProjectItem = {
  id: string
  name: string
  status: string | null
}

export type ClientProposalItem = {
  id: string
  number: string | null
  title: string | null
  status: string | null
  total: number | null
}

export type ClientInvoiceItem = {
  id: string
  full_number: string | null
  status: string | null
  total: number | null
  issue_date: string | null
}

export type ClientTaskItem = {
  id: string
  title: string
  status: string
  due_date: string | null
}

export type ClientWebItem = {
  id: string
  name: string
  url: string
  project_id: string | null
  project_name: string | null
  is_client_visible: boolean
}

// ─── Full client record ────────────────────────────────────────────────────────

export type ClientDetail = {
  id: string
  /** Internal optimistic-concurrency token. */
  version: number
  name: string
  /** Optional short display name. Falls back to `name` when null. */
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
  fiscal_verification_status: FiscalVerificationStatus
  fiscal_verified_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type ClientOriginLead = {
  id: string
  name: string
  company: string | null
}

export type ClientDetailResult = {
  client: ClientDetail
  /** Lead from which this client was converted, when applicable. */
  originLead: ClientOriginLead | null
  projects: ClientProjectItem[]
  proposals: ClientProposalItem[]
  invoices: ClientInvoiceItem[]
  /** Tasks directly associated with this client, newest first. */
  tasks: ClientTaskItem[]
  /** Pending reminders scheduled against this client, soonest first. */
  reminders: ReminderRow[]
  /** Web inventory entries assigned to this client. */
  webs: ClientWebItem[]
} | null
