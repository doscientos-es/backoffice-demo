/**
 * Returns the client's display name: the short `label` when set, otherwise
 * the legal `name`. Use this everywhere the client is shown to users (lists,
 * page titles, dropdowns). Billing documents (invoices, PDFs) should always
 * use the raw `name` (razón social).
 */
export function clientDisplayName(client: { name: string; label?: string | null }): string {
  return client.label?.trim() || client.name
}
