import { scopedLogger } from "@/lib/logger";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import { escapeIlike } from "@/lib/utils/search-params";

import type { InvoicePdfWorkLogInput } from "./pdf-data";
import {
  type ClientInfo,
  type CompanySettings,
  INVOICE_LIST_PAGE_SIZE,
  type InvoiceDetailResult,
  type InvoiceForEmail,
  type InvoiceForRectification,
  type InvoiceForVerifactu,
  type InvoiceHeaderPatch,
  type InvoiceItemInsert,
  type InvoiceListParams,
  type InvoiceListResult,
  type InvoiceStatusPatch,
  type InvoiceTimestamps,
  type NewInvoiceData,
  type ProjectForHourlyBilling,
  type ProposalForInvoice,
  type ProposalItem,
  type VatLineItem,
  type VerifactuChainEntry,
  type VerifactuPatch,
  type WorkLogEntry,
} from "./types";

const log = scopedLogger("invoices.queries");

type InvoiceConceptRow = {
  description: string | null;
  position: number | null;
};

export function invoiceConcepts(items: InvoiceConceptRow[] | null | undefined): string[] {
  return [...(items ?? [])]
    .sort(
      (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER),
    )
    .map((item) => item.description?.trim() ?? "")
    .filter(Boolean);
}

export async function listInvoices(params: InvoiceListParams): Promise<InvoiceListResult> {
  const supabase = await createServerClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * INVOICE_LIST_PAGE_SIZE;
  const to = from + INVOICE_LIST_PAGE_SIZE - 1;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [listRes, pendingRes, overdueRes, paidMonthRes, verifactuKoRes] = await Promise.all([
    (() => {
      let query = notDeleted(
        supabase
          .from("invoices")
          .select(
            "id, client_id, full_number, idfact, status, verifactu_status, total, issue_date, due_date, client_name, invoice_items(description, position)",
            { count: "exact" },
          ),
      );
      if (params.q && params.q.length > 0) {
        const pattern = `%${escapeIlike(params.q)}%`;
        query = query.or(
          `full_number.ilike.${pattern},idfact.ilike.${pattern},client_name.ilike.${pattern}`,
        );
      }
      if (params.status) query = query.eq("status", params.status);
      if (params.verifactu) query = query.eq("verifactu_status", params.verifactu);
      const sortCol = params.sort ?? "issue_date";
      const ascending = params.dir === "asc";
      return query.order(sortCol, { ascending, nullsFirst: false }).range(from, to);
    })(),
    notDeleted(supabase.from("invoices").select("total", { count: "exact" })).eq(
      "status",
      "issued",
    ),
    notDeleted(supabase.from("invoices").select("total", { count: "exact" })).eq(
      "status",
      "overdue",
    ),
    notDeleted(supabase.from("invoices").select("total"))
      .eq("status", "paid")
      .gte("issue_date", monthStart),
    notDeleted(supabase.from("invoices").select("id", { count: "exact", head: true })).in(
      "verifactu_status",
      ["rejected", "error"],
    ),
  ]);

  if (listRes.error) log.error({ err: listRes.error.message }, "list_invoices_failed");

  const pendingTotal = (pendingRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const overdueTotal = (overdueRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const paidMonthTotal = (paidMonthRes.data ?? []).reduce(
    (acc, r) => acc + Number(r.total ?? 0),
    0,
  );

  return {
    data: (listRes.data ?? []).map((i) => ({
      id: i.id as string,
      client_id: i.client_id as string,
      full_number: (i.full_number as string | null) ?? null,
      idfact: (i.idfact as string | null) ?? null,
      concepts: invoiceConcepts(
        (
          i as unknown as {
            invoice_items: InvoiceConceptRow[] | null;
          }
        ).invoice_items,
      ),
      status: (i.status as string | null) ?? null,
      verifactu_status: (i.verifactu_status as string | null) ?? null,
      total: i.total == null ? null : Number(i.total),
      issue_date: (i.issue_date as string | null) ?? null,
      due_date: (i.due_date as string | null) ?? null,
      client_name: (i.client_name as string | null) ?? null,
    })),
    count: listRes.count ?? 0,
    stats: {
      pendingTotal,
      pendingCount: pendingRes.count ?? 0,
      overdueTotal,
      overdueCount: overdueRes.count ?? 0,
      paidMonthTotal,
      verifactuKoCount: verifactuKoRes.count ?? 0,
    },
    error: listRes.error?.message ?? null,
  };
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetailResult> {
  const supabase = await createServerClient();

  const { data: invoice, error } = await notDeleted(
    supabase
      .from("invoices")
      .select("*, clients(id, name, logo_url), projects(id, name)")
      .eq("id", id),
  ).maybeSingle();

  if (error) log.error({ invoiceId: id, err: error.message }, "get_invoice_detail_failed");
  if (!invoice) return null;

  const [{ data: items }, { data: settings }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
      .eq("invoice_id", id)
      .order("position"),
    supabase
      .from("settings")
      .select("company_name, company_nif, company_address, iban, payment_terms")
      .eq("id", 1)
      .single(),
  ]);

  const client =
    (
      invoice as unknown as {
        clients: { id: string; name: string; logo_url: string | null } | null;
      }
    ).clients ?? null;
  const project =
    (invoice as unknown as { projects: { id: string; name: string } | null }).projects ?? null;

  return {
    invoice: {
      id: invoice.id as string,
      full_number: (invoice.full_number as string | null) ?? null,
      idfact: (invoice.idfact as string | null) ?? null,
      invoice_type: (invoice.invoice_type as string | null) ?? null,
      status: (invoice.status as string | null) ?? null,
      verifactu_status: (invoice.verifactu_status as string | null) ?? null,
      verifactu_csv: (invoice.verifactu_csv as string | null) ?? null,
      qr_url: (invoice.qr_url as string | null) ?? null,
      subtotal: invoice.subtotal == null ? null : Number(invoice.subtotal),
      total: invoice.total == null ? null : Number(invoice.total),
      issue_date: (invoice.issue_date as string | null) ?? null,
      due_date: (invoice.due_date as string | null) ?? null,
      client_nif: (invoice.client_nif as string | null) ?? null,
      client_address_street: (invoice.client_address_street as string | null) ?? null,
      client_address_zip: (invoice.client_address_zip as string | null) ?? null,
      client_address_city: (invoice.client_address_city as string | null) ?? null,
      client_address_province: (invoice.client_address_province as string | null) ?? null,
      client_address_country: (invoice.client_address_country as string | null) ?? null,
      payment_terms: (invoice.payment_terms as string | null) ?? null,
      client,
      project,
    },
    items: (items ?? []).map((item) => ({
      id: item.id as string,
      position: (item.position as number | null) ?? null,
      description: (item.description as string | null) ?? null,
      quantity: (item.quantity as number | null) ?? null,
      unit_price: (item.unit_price as number | null) ?? null,
      vat_rate: (item.vat_rate as number | null) ?? null,
      subtotal: (item.subtotal as number | null) ?? null,
    })),
    settings: settings
      ? {
          company_name: (settings.company_name as string | null) ?? null,
          company_nif: (settings.company_nif as string | null) ?? null,
          company_address: (settings.company_address as string | null) ?? null,
          iban: (settings.iban as string | null) ?? null,
          payment_terms: (settings.payment_terms as string | null) ?? null,
        }
      : null,
  };
}

// ─── Status / soft-delete mutations ──────────────────────────────────────────

/**
 * Returns `issued_at` for the invoice so the caller can decide whether
 * to stamp it. Returns `null` when the invoice does not exist.
 */
export async function findInvoiceTimestamps(id: string): Promise<InvoiceTimestamps | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("issued_at, client_id")
    .eq("id", id)
    .maybeSingle();
  return data
    ? {
        issued_at: (data.issued_at as string | null) ?? null,
        client_id: (data.client_id as string | null) ?? null,
      }
    : null;
}

/**
 * Overwrites the client snapshot fields on a draft invoice with fresh data
 * from the client record. The `.eq("status", "draft")` guard is an extra
 * safety net on top of the `fn_check_invoice_immutable` trigger.
 */
export async function patchInvoiceClientSnapshot(
  id: string,
  snapshot: {
    client_nif: string | null;
    client_name: string | null;
    client_address_street: string | null;
    client_address_zip: string | null;
    client_address_city: string | null;
    client_address_province: string | null;
    client_address_country: string | null;
  },
): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({ ...snapshot, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw new Error(error.message);
}

/** Applies a status/timestamp patch to an invoice row. Throws on DB error. */
export async function patchInvoiceStatus(id: string, patch: InvoiceStatusPatch): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Soft-deletes an invoice by stamping `deleted_at`. Throws on DB error. */
export async function softDeleteInvoice(id: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Clears `deleted_at`, reversing a soft-delete. Throws on DB error. */
export async function restoreDeletedInvoice(id: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("invoices").update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Verifactu queries ────────────────────────────────────────────────────────

/**
 * Fetches the invoice columns required for Verifactu submission.
 * Returns `null` when the invoice is deleted or does not exist.
 */
export async function findInvoiceForVerifactu(id: string): Promise<InvoiceForVerifactu | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, client_id, status, verifactu_status, full_number, invoice_type, issue_date, tax_amount, total, previous_hash, chain_sequence, client_nif, client_name",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) log.error({ invoiceId: id, err: error.message }, "find_invoice_for_verifactu_failed");
  if (!data) return null;
  return {
    id: data.id as string,
    client_id: (data.client_id as string | null) ?? null,
    status: data.status as string,
    verifactu_status: data.verifactu_status as string,
    full_number: data.full_number as string,
    invoice_type: data.invoice_type as string,
    issue_date: data.issue_date as string,
    tax_amount: Number(data.tax_amount ?? 0),
    total: Number(data.total ?? 0),
    previous_hash: (data.previous_hash as string | null) ?? null,
    chain_sequence: (data.chain_sequence as number | null) ?? null,
    client_nif: (data.client_nif as string | null) ?? null,
    client_name: (data.client_name as string | null) ?? null,
  };
}

/**
 * Returns the most recently accepted invoice in the Verifactu hash chain,
 * or `null` when no accepted invoices exist yet.
 */
export async function findLastVerifactuChainEntry(): Promise<VerifactuChainEntry | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("current_hash, chain_sequence, full_number, issue_date")
    .eq("verifactu_status", "accepted")
    .not("current_hash", "is", null)
    .order("chain_sequence", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    current_hash: data.current_hash as string,
    chain_sequence: data.chain_sequence as number,
    full_number: data.full_number as string,
    issue_date: data.issue_date as string,
  };
}

/** Returns the line items needed to build the Verifactu VAT breakdown. */
export async function findInvoiceItemsForVat(id: string): Promise<VatLineItem[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("invoice_items")
    .select("description, vat_rate, subtotal")
    .eq("invoice_id", id)
    .order("position");
  return (data ?? []).map((it) => ({
    description: (it.description as string | null) ?? null,
    vat_rate: Number(it.vat_rate ?? 0),
    subtotal: Number(it.subtotal ?? 0),
  }));
}

/** Returns company-level Verifactu settings (NIF + name). */
export async function findCompanySettings(): Promise<CompanySettings | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("settings")
    .select("company_nif, company_name")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return null;
  return {
    company_nif: (data.company_nif as string | null) ?? null,
    company_name: (data.company_name as string | null) ?? "",
  };
}

/** Persists the Verifactu submission result on the invoice row. Throws on DB error. */
export async function patchInvoiceAfterVerifactu(id: string, patch: VerifactuPatch): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Invoice creation helpers ─────────────────────────────────────────────────

/** Returns the proposal header needed to create a derived invoice. */
export async function findProposalForInvoice(
  proposalId: string,
): Promise<ProposalForInvoice | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("proposals")
    .select("id, client_id, project_id, status, title, notes, payment_schedule, payment_plan")
    .eq("id", proposalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    client_id: data.client_id as string,
    project_id: (data.project_id as string | null) ?? null,
    status: data.status as string,
    title: (data.title as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    payment_schedule: (data.payment_schedule as string | null) ?? null,
    payment_plan: data.payment_plan,
  };
}

/** Plan item ids which already own a non-deleted invoice for this proposal. */
export async function findInvoicedProposalPaymentPlanIds(proposalId: string): Promise<Set<string>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("proposal_payment_plan_item_id")
    .eq("proposal_id", proposalId)
    .is("deleted_at", null)
    .not("proposal_payment_plan_item_id", "is", null);
  if (error) throw new Error(error.message);
  return new Set(
    (data ?? [])
      .map((invoice) => invoice.proposal_payment_plan_item_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );
}

/** Returns all line items for a proposal, ordered by position. */
export async function findProposalItems(proposalId: string): Promise<ProposalItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("proposal_items")
    .select("position, description, quantity, unit_price, vat_rate, billing_cycle")
    .eq("proposal_id", proposalId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((it) => ({
    position: it.position as number,
    description: (it.description as string | null) ?? null,
    quantity: Number(it.quantity ?? 0),
    unit_price: Number(it.unit_price ?? 0),
    vat_rate: Number(it.vat_rate ?? 0),
    billing_cycle: (it.billing_cycle as string | null) ?? null,
  }));
}

/** Returns client snapshot fields denormalized onto invoices. */
export async function findClientInfo(clientId: string): Promise<ClientInfo | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "name, nif, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;
  return {
    name: (data.name as string | null) ?? null,
    nif: (data.nif as string | null) ?? null,
    billing_address_street: (data.billing_address_street as string | null) ?? null,
    billing_address_zip: (data.billing_address_zip as string | null) ?? null,
    billing_address_city: (data.billing_address_city as string | null) ?? null,
    billing_address_province: (data.billing_address_province as string | null) ?? null,
    billing_address_country: (data.billing_address_country as string | null) ?? null,
  };
}

/**
 * Returns the configured invoice series from the singleton settings row,
 * defaulting to `"A"` when absent or blank.
 */
export async function findInvoiceSeries(): Promise<string> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("settings")
    .select("invoice_series")
    .eq("id", 1)
    .maybeSingle();
  return ((data?.invoice_series as string | null) ?? "A").trim() || "A";
}

/**
 * Returns the next available invoice number for a given series.
 * Reads the current maximum and adds 1.
 */
/**
 * Returns the next available invoice number for a given series.
 * Uses the `next_invoice_number` RPC which acquires an advisory lock to
 * serialise concurrent calls and avoid duplicate number collisions.
 */
export async function findNextInvoiceNumberForSeries(series: string): Promise<number> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("next_invoice_number", { p_series: series });
  if (error) throw new Error(error.message);
  return data as number;
}

/**
 * Inserts a new invoice row and its line items.
 * Returns the new invoice `id`. Throws on any DB error.
 *
 * Note: Supabase JS does not expose explicit transactions; items are inserted
 * after the invoice. A failure on items is logged but does not roll back the
 * invoice — the caller is responsible for cleanup if needed.
 */
export async function insertInvoiceWithItems(
  invoiceData: NewInvoiceData,
  items: InvoiceItemInsert[],
): Promise<{ id: string }> {
  const supabase = await createServerClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert(invoiceData)
    .select("id")
    .single();
  if (invoiceError || !invoice)
    throw new Error(invoiceError?.message ?? "No se pudo crear la factura");

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(items.map((it) => ({ ...it, invoice_id: invoice.id as string })));
  if (itemsError) {
    log.error({ err: itemsError, invoiceId: invoice.id }, "insert_invoice_items_failed");
    throw new Error(itemsError.message);
  }

  return { id: invoice.id as string };
}

// ─── Hourly invoice helpers ───────────────────────────────────────────────────

/** Returns project billing data for generating a monthly hourly invoice. */
export async function findProjectForHourlyBilling(
  projectId: string,
): Promise<ProjectForHourlyBilling | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("projects")
    .select("id, client_id, name, billing_type, hourly_rate, hourly_vat_rate")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    client_id: data.client_id as string,
    name: data.name as string,
    billing_type: data.billing_type as string,
    hourly_rate: Number(data.hourly_rate ?? 0),
    hourly_vat_rate: Number(data.hourly_vat_rate ?? 0),
  };
}

/**
 * Returns work logs for a project in the given month window that are not
 * yet linked to any invoice.
 */
export async function findUnlinkedWorkLogsForMonth(
  projectId: string,
  monthStart: string,
  monthEnd: string,
): Promise<WorkLogEntry[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("work_logs")
    .select("id, hours")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .is("invoice_id", null)
    .gte("work_date", monthStart)
    .lt("work_date", monthEnd)
    .order("work_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => ({ id: l.id as string, hours: Number(l.hours ?? 0) }));
}

/** Links a set of work-log rows to an invoice so they can't be double-billed. */
export async function linkWorkLogsToInvoice(logIds: string[], invoiceId: string): Promise<void> {
  if (logIds.length === 0) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("work_logs")
    .update({ invoice_id: invoiceId })
    .in("id", logIds);
  if (error) throw new Error(error.message);
}

/**
 * Returns the work logs linked to an invoice, with member name, ordered by
 * date. Used to render the tracked-hours breakdown page of the invoice PDF.
 */
export async function findWorkLogsForInvoice(invoiceId: string): Promise<InvoicePdfWorkLogInput[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("work_logs")
    .select("work_date, hours, start_time, end_time, note, team_members:member_id(name)")
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .order("work_date", { ascending: true });
  if (error) {
    log.error({ invoiceId, err: error.message }, "find_work_logs_for_invoice_failed");
    return [];
  }
  return (data ?? []).map((w) => {
    const member = w.team_members as unknown as { name: string } | null;
    return {
      work_date: (w.work_date as string | null) ?? null,
      member_name: member?.name ?? null,
      start_time: ((w.start_time as string | null) ?? null)?.slice(0, 5) ?? null,
      end_time: ((w.end_time as string | null) ?? null)?.slice(0, 5) ?? null,
      hours: Number(w.hours ?? 0),
      note: (w.note as string | null) ?? null,
    };
  });
}

// ─── Invoice edit helpers ─────────────────────────────────────────────────────

/**
 * Returns the current status of an invoice so the caller can guard edits.
 * Returns `null` when the invoice does not exist.
 */
export async function findInvoiceForEdit(id: string): Promise<{ status: string } | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("invoices").select("status").eq("id", id).single();
  if (!data) return null;
  return { status: data.status as string };
}

/** Applies a partial header patch to a draft invoice. Throws on DB error. */
export async function patchInvoiceHeader(id: string, patch: InvoiceHeaderPatch): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Replaces all line items for an invoice atomically:
 * deletes existing rows and inserts the new set.
 * Throws on any DB error.
 */
export async function replaceInvoiceItems(
  invoiceId: string,
  items: InvoiceItemInsert[],
): Promise<void> {
  const supabase = await createServerClient();
  const { error: deleteError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase
    .from("invoice_items")
    .insert(items.map((it, idx) => ({ ...it, position: idx, invoice_id: invoiceId })));
  if (insertError) throw new Error(insertError.message);
}

// ─── Portal access ────────────────────────────────────────────────────────────

/** Applies a portal-access patch (visibility + password) to an invoice. Throws on DB error. */
export async function patchInvoicePortal(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Email helpers ────────────────────────────────────────────────────────────

/**
 * Returns the invoice fields needed to compose and send the client portal email.
 * Returns `null` when the invoice is deleted or does not exist.
 */
export async function findInvoiceForEmail(id: string): Promise<InvoiceForEmail | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, full_number, total, due_date, status, portal_token, is_client_visible, clients(name, email)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) log.error({ invoiceId: id, err: error.message }, "find_invoice_for_email_failed");
  if (!data) return null;

  const rawClient = (data as unknown as { clients: { name: string; email: string | null } | null })
    .clients;
  return {
    id: data.id as string,
    full_number: (data.full_number as string | null) ?? null,
    total: data.total == null ? null : Number(data.total),
    due_date: (data.due_date as string | null) ?? null,
    status: data.status as string,
    portal_token: (data.portal_token as string | null) ?? null,
    is_client_visible: Boolean(data.is_client_visible),
    client: rawClient ?? null,
  };
}

// ─── Rectification helpers ────────────────────────────────────────────────────

/**
 * Fetches the original invoice fields needed to clone a rectification invoice.
 * Returns `null` when the invoice is deleted or does not exist.
 */
export async function findInvoiceForRectification(
  id: string,
): Promise<InvoiceForRectification | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, status, verifactu_status, invoice_type, full_number, series, number, issue_date, client_id, project_id, client_nif, client_name, client_address_street, client_address_zip, client_address_city, client_address_province, client_address_country, notes, payment_terms, subtotal, tax_amount, total, is_rectification",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error)
    log.error({ invoiceId: id, err: error.message }, "find_invoice_for_rectification_failed");
  if (!data) return null;
  return {
    id: data.id as string,
    status: data.status as string,
    verifactu_status: data.verifactu_status as string,
    invoice_type: data.invoice_type as string,
    full_number: data.full_number as string,
    series: data.series as string,
    number: data.number as number,
    issue_date: data.issue_date as string,
    client_id: data.client_id as string,
    project_id: (data.project_id as string | null) ?? null,
    client_nif: (data.client_nif as string | null) ?? null,
    client_name: (data.client_name as string | null) ?? null,
    client_address_street: (data.client_address_street as string | null) ?? null,
    client_address_zip: (data.client_address_zip as string | null) ?? null,
    client_address_city: (data.client_address_city as string | null) ?? null,
    client_address_province: (data.client_address_province as string | null) ?? null,
    client_address_country: (data.client_address_country as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    payment_terms: (data.payment_terms as string | null) ?? null,
    subtotal: Number(data.subtotal ?? 0),
    tax_amount: Number(data.tax_amount ?? 0),
    total: Number(data.total ?? 0),
    is_rectification: Boolean(data.is_rectification),
  };
}

/**
 * Inserts a rectification invoice with its cloned line items.
 * Uses explicit casts for the new rectification columns not yet in generated types.
 */
export async function insertRectificationWithItems(
  invoiceData: NewInvoiceData & {
    invoice_type: string;
    is_rectification: true;
    rectified_invoice_id: string;
    rectification_reason: string;
    rectification_type: string;
  },
  items: InvoiceItemInsert[],
): Promise<{ id: string }> {
  const supabase = await createServerClient();
  // Cast to `any` because the generated DB types don't include the new
  // rectification columns until the schema types are regenerated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    // biome-ignore lint/suspicious/noExplicitAny: new columns not yet in generated types
    .insert(invoiceData as any)
    .select("id")
    .single();
  if (invoiceError || !invoice)
    throw new Error(invoiceError?.message ?? "No se pudo crear la factura rectificativa");

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(items.map((it) => ({ ...it, invoice_id: invoice.id as string })));
  if (itemsError) {
    log.error({ err: itemsError, invoiceId: invoice.id }, "insert_rectification_items_failed");
    throw new Error(itemsError.message);
  }

  return { id: invoice.id as string };
}
