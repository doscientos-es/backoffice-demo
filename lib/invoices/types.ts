/**
 * Shared types and constants for the invoices domain.
 */

export const INVOICE_LIST_PAGE_SIZE = 25;

// ─── List ─────────────────────────────────────────────────────────────────────

export type InvoiceListItem = {
  id: string;
  client_id: string;
  full_number: string | null;
  idfact: string | null;
  concepts: string[];
  status: string | null;
  verifactu_status: string | null;
  total: number | null;
  issue_date: string | null;
  due_date: string | null;
  client_name: string | null;
};

export type InvoiceStats = {
  pendingTotal: number;
  pendingCount: number;
  overdueTotal: number;
  overdueCount: number;
  paidMonthTotal: number;
  verifactuKoCount: number;
};

export const INVOICE_SORT_COLUMNS = [
  "full_number",
  "client_name",
  "status",
  "total",
  "issue_date",
  "due_date",
] as const;

export type InvoiceListParams = {
  q?: string;
  status?: string;
  verifactu?: string;
  page?: number;
  sort?: string;
  dir?: "asc" | "desc";
};

export type InvoiceListResult = {
  data: InvoiceListItem[];
  count: number;
  stats: InvoiceStats;
  error: string | null;
};

// ─── Detail ────────────────────────────────────────────────────────────────────

export type InvoiceDetailClient = {
  id: string;
  name: string;
  logo_url: string | null;
};

export type InvoiceDetailProject = {
  id: string;
  name: string;
};

export type InvoiceLineItem = {
  id: string;
  position: number | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  subtotal: number | null;
};

export type InvoiceSettings = {
  company_name: string | null;
  company_nif: string | null;
  company_address: string | null;
  iban: string | null;
  payment_terms: string | null;
};

export type InvoiceDetail = {
  id: string;
  full_number: string | null;
  idfact: string | null;
  invoice_type: string | null;
  status: string | null;
  verifactu_status: string | null;
  verifactu_csv: string | null;
  qr_url: string | null;
  subtotal: number | null;
  total: number | null;
  issue_date: string | null;
  due_date: string | null;
  client_nif: string | null;
  client_address_street: string | null;
  client_address_zip: string | null;
  client_address_city: string | null;
  client_address_province: string | null;
  client_address_country: string | null;
  payment_terms: string | null;
  client: InvoiceDetailClient | null;
  project: InvoiceDetailProject | null;
};

export type InvoiceDetailResult = {
  invoice: InvoiceDetail;
  items: InvoiceLineItem[];
  settings: InvoiceSettings | null;
} | null;

// ─── Query-level shapes (read) ────────────────────────────────────────────────

/** Minimal timestamps fetched before a status transition. */
export type InvoiceTimestamps = { issued_at: string | null; client_id: string | null };

/** Payload fetched before submitting to Verifactu. */
export type InvoiceForVerifactu = {
  id: string;
  client_id: string | null;
  status: string;
  verifactu_status: string;
  full_number: string;
  invoice_type: string;
  issue_date: string;
  tax_amount: number;
  total: number;
  previous_hash: string | null;
  chain_sequence: number | null;
  client_nif: string | null;
  client_name: string | null;
};

/** Last accepted invoice in the Verifactu hash chain. */
export type VerifactuChainEntry = {
  current_hash: string;
  chain_sequence: number;
  full_number: string;
  issue_date: string;
};

/** Line item stripped to what the VAT breakdown calculation needs. */
export type VatLineItem = {
  vat_rate: number;
  subtotal: number;
  description: string | null;
};

/** Company-level settings consumed during Verifactu submission. */
export type CompanySettings = {
  company_nif: string | null;
  company_name: string;
};

/** Proposal header needed when creating a derived invoice. */
export type ProposalForInvoice = {
  id: string;
  client_id: string;
  project_id: string | null;
  status: string;
  title: string | null;
  notes: string | null;
  payment_schedule: string | null;
  payment_plan: unknown;
};

/** Proposal line item shape used during invoice creation. */
export type ProposalItem = {
  position: number;
  description: string | null;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  billing_cycle: string | null;
};

/** Client snapshot denormalized onto new invoices. */
export type ClientInfo = {
  name: string | null;
  nif: string | null;
  billing_address_street: string | null;
  billing_address_zip: string | null;
  billing_address_city: string | null;
  billing_address_province: string | null;
  billing_address_country: string | null;
};

/** Project data needed to create a monthly hourly invoice. */
export type ProjectForHourlyBilling = {
  id: string;
  client_id: string;
  name: string;
  billing_type: string;
  hourly_rate: number;
  hourly_vat_rate: number;
};

/** Work-log row used when aggregating hours for a monthly invoice. */
export type WorkLogEntry = {
  id: string;
  hours: number;
};

/** Invoice row used to prefill and send the client portal email. */
export type InvoiceForEmail = {
  id: string;
  full_number: string | null;
  total: number | null;
  due_date: string | null;
  status: string;
  portal_token: string | null;
  is_client_visible: boolean;
  client: { name: string; email: string | null } | null;
};

// ─── Query-level shapes (write) ───────────────────────────────────────────────

/**
 * All fields needed to read an invoice before creating a rectification.
 * Includes items so the caller can clone them onto the new invoice.
 */
export type InvoiceForRectification = {
  id: string;
  status: string;
  verifactu_status: string;
  invoice_type: string;
  full_number: string;
  series: string;
  number: number;
  issue_date: string;
  client_id: string;
  project_id: string | null;
  client_nif: string | null;
  client_name: string | null;
  client_address_street: string | null;
  client_address_zip: string | null;
  client_address_city: string | null;
  client_address_province: string | null;
  client_address_country: string | null;
  notes: string | null;
  payment_terms: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  is_rectification: boolean;
};

/** Fields patched when an invoice's status changes. */
export type InvoiceStatusPatch = {
  status: string;
  updated_at: string;
  paid_at: string | null;
  payment_method?: string | null;
  issued_at?: string;
  // Client snapshot — refreshed on first issuance so draft edits to the client are captured.
  client_nif?: string | null;
  client_name?: string | null;
  client_address_street?: string | null;
  client_address_zip?: string | null;
  client_address_city?: string | null;
  client_address_province?: string | null;
  client_address_country?: string | null;
};

/** Fields patched after a Verifactu submission attempt. */
export type VerifactuPatch = {
  idfact: string;
  previous_hash: string | null;
  current_hash: string;
  chain_sequence: number | null;
  hash_generated_at: string;
  verifactu_status: string;
  verifactu_submitted_at: string;
  verifactu_csv: string | null;
  verifactu_response: unknown;
  verifactu_error: string | null;
  qr_url: string;
};

/** Data required to insert a new invoice row. */
export type NewInvoiceData = {
  client_id: string;
  project_id: string | null;
  proposal_id?: string | null;
  proposal_payment_plan_item_id?: string | null;
  series: string;
  status: "draft";
  currency: "EUR";
  subtotal: number;
  tax_amount: number;
  total: number;
  due_date?: string | null;
  client_nif: string | null;
  client_name: string | null;
  client_address_street: string | null;
  client_address_zip: string | null;
  client_address_city: string | null;
  client_address_province: string | null;
  client_address_country: string | null;
  notes?: string | null;
  payment_terms?: string | null;
  created_by: string;
};

/** Single line item used when inserting invoice_items rows. */
export type InvoiceItemInsert = {
  position: number;
  description: string | null;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

/** Fields that can be patched on a draft invoice header. */
export type InvoiceHeaderPatch = {
  updated_at: string;
  issue_date?: string;
  due_date?: string | null;
  notes?: string | null;
  payment_terms?: string | null;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
};
