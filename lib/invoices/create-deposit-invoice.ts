import type { LocalDataClient } from "@/lib/demo/local-data";

import { computeLineTotals } from "@/lib/finance";

type DepositInvoiceResult = { ok: true; invoiceId: string } | { ok: false; error: string };

/**
 * Creates a draft invoice for a proposal deposit (señal/anticipo).
 * Designed for use with the admin client — no user session required.
 *
 * The deposit amount is treated as the VAT-inclusive total. The effective
 * VAT rate is derived from the proposal's own subtotal/tax_amount ratio so
 * mixed-rate proposals are handled correctly.
 */
export async function createDepositInvoice(
  supabase: LocalDataClient,
  proposalId: string,
  depositAmount: number,
): Promise<DepositInvoiceResult> {
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, client_id, project_id, number, title, subtotal, tax_amount, total")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) return { ok: false, error: "Propuesta no encontrada" };

  const { data: client } = await supabase
    .from("clients")
    .select("name, nif, billing_address")
    .eq("id", proposal.client_id as string)
    .maybeSingle();

  const { data: settings } = await supabase
    .from("settings")
    .select("invoice_series, default_vat_rate")
    .eq("id", 1)
    .maybeSingle();

  const series = ((settings?.invoice_series as string | null) ?? "A").trim() || "A";

  // Derive effective VAT rate from the proposal (handles mixed-rate items).
  const proposalSubtotal = Number(proposal.subtotal ?? 0);
  const proposalTax = Number(proposal.tax_amount ?? 0);
  const proposalTotal = Number(proposal.total ?? 1);
  const effectiveVatRate =
    proposalSubtotal > 0
      ? Math.round((proposalTax / proposalSubtotal) * 10000) / 100 // 2 decimal places
      : Number(settings?.default_vat_rate ?? 21);

  // Back-calculate the deposit base price from the VAT-inclusive deposit amount.
  const depositRatio = depositAmount / proposalTotal;
  const unitPrice = Math.round(proposalSubtotal * depositRatio * 100) / 100;

  const { subtotal, taxAmount, total } = computeLineTotals([
    { quantity: 1, unit_price: unitPrice, vat_rate: effectiveVatRate },
  ]);

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      client_id: proposal.client_id,
      project_id: (proposal.project_id as string | null) ?? null,
      proposal_id: proposal.id,
      series,
      status: "draft",
      currency: "EUR",
      subtotal,
      tax_amount: taxAmount,
      total,
      client_nif: (client?.nif as string | null) ?? null,
      client_name: (client?.name as string | null) ?? null,
      client_address: (client?.billing_address as string | null) ?? null,
      notes: `Señal/anticipo sobre propuesta ${proposal.number as string}: ${proposal.title as string}`,
      // created_by left null — system-generated invoice from portal payment
    })
    .select("id")
    .single();

  if (insertError || !invoice) {
    return { ok: false, error: insertError?.message ?? "No se pudo crear la factura de anticipo" };
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    position: 0,
    description: `Señal/anticipo — ${proposal.number as string}: ${proposal.title as string}`,
    quantity: 1,
    unit_price: unitPrice,
    vat_rate: effectiveVatRate,
  });

  if (itemError) {
    return { ok: false, error: itemError.message };
  }

  return { ok: true, invoiceId: invoice.id as string };
}
