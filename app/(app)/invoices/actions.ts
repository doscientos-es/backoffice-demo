"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { InvoiceEmail } from "@/components/email";
import { defineAction } from "@/lib/actions/define-action";
import { requireRole } from "@/lib/auth";
import { ensureInvoiceRecipientVerified } from "@/lib/clients/fiscal-verification";
import { VersionConflictError } from "@/lib/concurrency/version-conflict";
import { hasCompleteFiscalData } from "@/lib/crm/conversion";
import { externalAppUrl } from "@/lib/email/app-url";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import { computeLineTotals } from "@/lib/finance";
import { backupInvoiceToDrive } from "@/lib/google/backup";
import { pushMetaConversion } from "@/lib/integrations/meta-capi";
import {
  findClientInfo,
  findInvoicedProposalPaymentPlanIds,
  findInvoiceForEdit,
  findInvoiceForEmail,
  findInvoiceSeries,
  findProposalForInvoice,
  findProposalItems,
  insertInvoiceWithItems,
  patchInvoiceClientSnapshot,
  patchInvoiceStatus,
  restoreDeletedInvoice,
  softDeleteInvoice,
} from "@/lib/invoices/queries";
import { getMonthlyBillingWindow } from "@/lib/invoices/workflows";
import { scopedLogger } from "@/lib/logger";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { buildPortalAccessPatch } from "@/lib/portal/access";
import {
  parsePaymentPlan,
  paymentPlanForSchedule,
  paymentScheduleInput,
  splitItemsForPaymentPlan,
} from "@/lib/proposals/scope";
import { uuidIdInput } from "@/lib/schemas/common";
import {
  CreateInvoiceFromProposalInput,
  CreateInvoicesFromProposalPlanInput,
  CreateMonthlyHourlyInvoiceInput,
  CreateRectificationInput,
  MarkUncollectibleInput,
  RecordInvoicePaymentInput,
  SendInvoiceEmailInput,
  SendInvoiceInput,
  UpdateInvoiceInput as UpdateInvoiceInputSchema,
  type UpdateInvoiceInputType,
  UpdateInvoiceStatusInput,
} from "@/lib/schemas/invoice";
import { UpdatePortalAccessInput } from "@/lib/schemas/portal";
import { consumeUserVerification } from "@/lib/security/user-verification";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { verifactuSoftwareSnapshotFromEnv } from "@/lib/verifactu/config";
import {
  assertDurableVerifactuPackage,
  deliverInvoiceVerifactu,
  deliverVerifactuOutbox,
  type OutboxDelivery,
  syncInvoiceQrFromLedger,
} from "@/lib/verifactu/outbox";

const log = scopedLogger("invoices.actions");

export type UpdateInvoiceInput = UpdateInvoiceInputType;

function outboxIdFromRpc(data: unknown): string {
  const row = Array.isArray(data) ? data[0] : data;
  const outboxId =
    row && typeof row === "object" ? (row as { outbox_id?: unknown }).outbox_id : null;
  if (typeof outboxId !== "string") throw new Error("No se pudo crear la cola de envío fiscal");
  return outboxId;
}

async function enqueueFiscalRecord(invoiceId: string, cancellation = false): Promise<string> {
  const supabase = await createServerClient();
  const functionName = cancellation
    ? "cancel_invoice_with_verifactu_outbox"
    : "issue_invoice_with_number_and_verifactu_outbox";
  const { data, error } = await supabase.rpc(functionName, {
    p_invoice_id: invoiceId,
    p_software: verifactuSoftwareSnapshotFromEnv(),
  });
  if (error) throw new Error(error.message);
  return outboxIdFromRpc(data);
}

async function enqueueVerifactuRegularization(invoiceId: string): Promise<string> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("regularize_verifactu_invoice", {
    p_invoice_id: invoiceId,
    p_software: verifactuSoftwareSnapshotFromEnv(),
  });
  if (error) throw new Error(error.message);
  return outboxIdFromRpc(data);
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Updates the status of an invoice. If moving to 'paid', we set 'paid_at'.
 * If moving to 'issued' from 'draft', we set 'issued_at'.
 * On first issuance the client snapshot (name, nif, address) is refreshed from
 * the current client record so any edits made while in draft are captured.
 * Best-effort Drive backup fires on first issuance.
 */
export const updateInvoiceStatus = defineAction<
  typeof UpdateInvoiceStatusInput,
  { fiscalDeliveryCsv: string | null; fiscalDeliveryStatus: OutboxDelivery["status"] | null }
>({
  name: "invoices.updateStatus",
  schema: UpdateInvoiceStatusInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input, { user }) => {
    const { id, status } = input;
    if (status === "issued" || status === "cancelled") {
      await consumeUserVerification(
        user.id,
        userVerificationScope("invoice.status.update", `invoice:${id}:status:${status}`),
      );
    }
    if (status === "issued" || status === "cancelled") {
      await assertDurableVerifactuPackage(status === "cancelled");
      const outboxId = await enqueueFiscalRecord(id, status === "cancelled");
      const delivery = await deliverVerifactuOutbox(outboxId, `action:${crypto.randomUUID()}`);
      if (status === "issued" && delivery.status === "accepted") {
        await syncInvoiceQrFromLedger(id);
      }
      if (delivery.status !== "accepted") {
        log.warn(
          { invoiceId: id, status: delivery.status },
          "verifactu_immediate_delivery_deferred",
        );
      }
      if (status === "issued") void backupInvoiceToDrive(id, user.email);
      return { fiscalDeliveryStatus: delivery.status, fiscalDeliveryCsv: delivery.csv };
    }

    const now = new Date().toISOString();

    await patchInvoiceStatus(id, {
      status,
      updated_at: now,
      paid_at: status === "paid" ? now : null,
      ...(status === "paid" && input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
    });

    // Fire-and-forget: notify Meta CAPI when an invoice is paid — the
    // highest-value signal for the ad algorithm to optimise towards.
    if (status === "paid") {
      after(async () => {
        try {
          const inv = await findInvoiceForEmail(id);
          if (inv?.client?.email) {
            await pushMetaConversion({
              eventName: "Purchase",
              eventId: `invoice-${id}-paid`,
              email: inv.client.email,
              value: inv.total,
              currency: "EUR",
              actionSource: "system_generated",
              custom_data: {
                event_source: "crm",
                lead_event_source: "doscientos-backoffice",
              },
            });
          }
        } catch (e) {
          log.warn({ err: e, invoiceId: id }, "meta_capi_purchase_failed");
        }
      });
    }

    return { fiscalDeliveryStatus: null, fiscalDeliveryCsv: null };
  },
});

/** Records a manual or gateway payment and closes the invoice when fully paid. */
export const recordInvoicePayment = defineAction<
  typeof RecordInvoicePaymentInput,
  { fullyPaid: boolean }
>({
  name: "invoices.recordPayment",
  schema: RecordInvoicePaymentInput,
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/finance", "/inicio"],
  handler: async (input, { user }) => {
    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("No tienes permisos para registrar cobros");
    }
    const admin = createAdminClient();
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select("status, total")
      .eq("id", input.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (invoiceError || !invoice) throw new Error("Factura no encontrada");
    if (!["issued", "overdue"].includes(invoice.status as string)) {
      throw new Error("Solo se pueden registrar cobros de facturas pendientes");
    }

    const amountCents = Math.round(input.amount * 100);
    const totalCents = Math.round(Number(invoice.total) * 100);
    if (amountCents <= 0) throw new Error("El importe debe ser mayor que cero");

    const { data: confirmed, error: paymentsError } = await admin
      .from("invoice_payments")
      .select("amount")
      .eq("invoice_id", input.id)
      .eq("status", "confirmed");
    if (paymentsError) throw new Error(paymentsError.message);

    const paidCents = Math.round(
      (confirmed ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) * 100,
    );
    const remainingCents = Math.max(0, totalCents - paidCents);
    if (amountCents > remainingCents) {
      throw new Error(`El importe supera el pendiente (${(remainingCents / 100).toFixed(2)} €)`);
    }

    const now = new Date().toISOString();
    const { error: insertError } = await admin.from("invoice_payments").insert({
      invoice_id: input.id,
      amount: amountCents / 100,
      status: "confirmed",
      payment_method: input.paymentMethod,
      ds_response: "MANUAL",
      confirmed_at: now,
    });
    if (insertError) throw new Error(insertError.message);

    const fullyPaid = paidCents + amountCents >= totalCents;
    await patchInvoiceStatus(input.id, {
      updated_at: now,
      status: fullyPaid ? "paid" : (invoice.status as string),
      paid_at: fullyPaid ? now : null,
      ...(fullyPaid
        ? { payment_method: input.paymentMethod }
        : { payment_method: input.paymentMethod }),
    });

    return { fullyPaid };
  },
});

/** Reverts a payment without re-emitting its immutable fiscal record. */
export const revertInvoicePayment = defineAction({
  name: "invoices.revertPayment",
  schema: uuidIdInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input, { user }) => {
    await consumeUserVerification(
      user.id,
      userVerificationScope("invoice.payment.revert", `invoice:${input.id}`),
    );
    const invoice = await findInvoiceForEdit(input.id);
    if (!invoice) throw new Error("Factura no encontrada");
    if (invoice.status !== "paid")
      throw new Error("Solo se puede revertir el cobro de una factura pagada");

    await patchInvoiceStatus(input.id, {
      status: "issued",
      updated_at: new Date().toISOString(),
      paid_at: null,
      payment_method: null,
    });
  },
});

// ─── Draft: reload client snapshot ───────────────────────────────────────────

/**
 * While the invoice is still a draft, pull the latest fiscal data from the
 * linked client record and overwrite the invoice snapshot fields. Once the
 * invoice is issued the immutability trigger will block any further edits.
 */
export const refreshInvoiceClientSnapshot = defineAction({
  name: "invoices.refreshClientSnapshot",
  schema: uuidIdInput,
  revalidate: (_p, input) => [`/invoices/${input.id}`],
  handler: async (input) => {
    const supabase = await createServerClient();

    // Fetch the invoice's linked client_id
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("client_id, status")
      .eq("id", input.id)
      .maybeSingle();
    if (invErr || !inv) throw new Error(invErr?.message ?? "Factura no encontrada");
    if (inv.status !== "draft") throw new Error("Solo se pueden actualizar facturas en borrador");
    if (!inv.client_id) throw new Error("La factura no tiene un cliente asociado");

    const client = await findClientInfo(inv.client_id as string);
    if (!client) throw new Error("Cliente no encontrado");

    await patchInvoiceClientSnapshot(input.id, {
      client_name: client.name,
      client_nif: client.nif,
      client_address_street: client.billing_address_street,
      client_address_zip: client.billing_address_zip,
      client_address_city: client.billing_address_city,
      client_address_province: client.billing_address_province,
      client_address_country: client.billing_address_country,
    });
  },
});

// ─── Soft-delete / restore ────────────────────────────────────────────────────

export const deleteInvoice = defineAction({
  name: "invoices.delete",
  schema: uuidIdInput,
  roles: ["owner", "admin"],
  revalidate: () => ["/invoices"],
  handler: async (input) => {
    // Facturas aceptadas por la AEAT no pueden eliminarse (RD 1007/2023 art. 8).
    // Debe emitirse una factura rectificativa en su lugar.
    const supabase = await createServerClient();
    const { data: inv } = await supabase
      .from("invoices")
      .select("verifactu_status")
      .eq("id", input.id)
      .maybeSingle();
    if (inv?.verifactu_status === "accepted") {
      throw new Error(
        "Las facturas aceptadas por la AEAT no pueden eliminarse. Emite una factura rectificativa.",
      );
    }
    await softDeleteInvoice(input.id);
  },
});

/**
 * Reverses a soft-delete. Backs the "Deshacer" toast shown after `deleteInvoice`.
 */
export const restoreInvoice = defineAction({
  name: "invoices.restore",
  schema: uuidIdInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices"],
  handler: async (input) => {
    await restoreDeletedInvoice(input.id);
  },
});

// ─── Verifactu (AEAT) ─────────────────────────────────────────────────────────

/**
 * Re-delivers the pre-generated RegistroAlta. It never recreates a hash or
 * overwrites fiscal evidence; a non-due/accepted job simply returns no CSV.
 */
export const sendToAeat = defineAction<
  typeof SendInvoiceInput,
  { csv: string | null; status: OutboxDelivery["status"]; error: string | null }
>({
  name: "invoices.sendToAeat",
  schema: SendInvoiceInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input, { user }) => {
    const { id } = input;
    await consumeUserVerification(
      user.id,
      userVerificationScope("invoice.send_aeat", `invoice:${id}`),
    );
    await assertDurableVerifactuPackage();
    const delivery = await deliverInvoiceVerifactu(id, `manual:${crypto.randomUUID()}`);
    return { csv: delivery.csv, status: delivery.status, error: delivery.error ?? null };
  },
});

/**
 * Creates the AEAT "alta por rechazo" recovery record. The failed immutable
 * record remains in the ledger; this appends Subsanacion=S/RechazoPrevio=X
 * and immediately attempts delivery with the currently configured SIF cert.
 */
export const regularizeVerifactu = defineAction<
  typeof SendInvoiceInput,
  { csv: string | null; status: OutboxDelivery["status"]; error: string | null }
>({
  name: "invoices.regularizeVerifactu",
  schema: SendInvoiceInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices", "/inicio"],
  handler: async (input, { user }) => {
    await consumeUserVerification(
      user.id,
      userVerificationScope("invoice.verifactu_regularize", `invoice:${input.id}`),
    );
    await assertDurableVerifactuPackage();
    await ensureInvoiceRecipientVerified(input.id, user.id);
    const outboxId = await enqueueVerifactuRegularization(input.id);
    const delivery = await deliverVerifactuOutbox(outboxId, `regularize:${crypto.randomUUID()}`);
    return { csv: delivery.csv, status: delivery.status, error: delivery.error ?? null };
  },
});

// ─── Invoice creation ─────────────────────────────────────────────────────────

/**
 * Creates a draft invoice from an accepted proposal, cloning the one-time line
 * items, totals, and client/project references.
 */
export const createInvoiceFromProposal = defineAction<
  typeof CreateInvoiceFromProposalInput,
  { id: string }
>({
  name: "invoices.createFromProposal",
  schema: CreateInvoiceFromProposalInput,
  revalidate: (_p, input) => ["/invoices", `/proposals/${input.proposalId}`],
  handler: async (input, { user }) => {
    const { proposalId } = input;
    const proposal = await findProposalForInvoice(proposalId);
    if (!proposal) throw new Error("Propuesta no encontrada");
    if (proposal.status !== "accepted")
      throw new Error("Solo se puede facturar una propuesta aceptada");
    if (!proposal.client_id)
      throw new Error(
        "La propuesta aceptada no tiene datos fiscales; completa la ficha fiscal antes de facturar",
      );

    const allItems = await findProposalItems(proposalId);
    if (allItems.length === 0) throw new Error("La propuesta no tiene líneas para facturar");

    // Only bill one-time lines; recurring lines are handled by periodic invoicing.
    const items = allItems.filter((it) => (it.billing_cycle ?? "none") === "none");
    if (items.length === 0) {
      throw new Error(
        "Esta propuesta solo contiene líneas recurrentes; crea la factura manualmente",
      );
    }

    const [client, series] = await Promise.all([
      findClientInfo(proposal.client_id),
      findInvoiceSeries(),
    ]);
    if (!client || !hasCompleteFiscalData(client)) {
      throw new Error(
        "La propuesta aceptada no tiene datos fiscales; completa la ficha fiscal antes de facturar",
      );
    }
    const { subtotal, taxAmount, total } = computeLineTotals(items);

    const { id } = await insertInvoiceWithItems(
      {
        client_id: proposal.client_id,
        project_id: proposal.project_id,
        proposal_id: proposal.id,
        series,
        status: "draft",
        currency: "EUR",
        subtotal,
        tax_amount: taxAmount,
        total,
        client_nif: client?.nif ?? null,
        client_name: client?.name ?? null,
        client_address_street: client?.billing_address_street ?? null,
        client_address_zip: client?.billing_address_zip ?? null,
        client_address_city: client?.billing_address_city ?? null,
        client_address_province: client?.billing_address_province ?? null,
        client_address_country: client?.billing_address_country ?? null,
        notes: proposal.notes,
        created_by: user.id,
      },
      items.map((it, idx) => ({
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
      })),
    );

    return { id };
  },
});

/**
 * Creates only the missing draft invoices for a proposal payment plan. Each
 * draft is linked to its plan item, which makes repeated clicks idempotent.
 */
export const createInvoicesFromProposalPlan = defineAction<
  typeof CreateInvoicesFromProposalPlanInput,
  { ids: string[]; created: number }
>({
  name: "invoices.createFromProposalPlan",
  schema: CreateInvoicesFromProposalPlanInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => ["/invoices", `/proposals/${input.proposalId}`],
  handler: async ({ proposalId }, { user }) => {
    const proposal = await findProposalForInvoice(proposalId);
    if (!proposal) throw new Error("Propuesta no encontrada");
    if (proposal.status !== "accepted") {
      throw new Error("Solo se puede facturar una propuesta aceptada");
    }
    if (!proposal.client_id) {
      throw new Error(
        "La propuesta aceptada no tiene datos fiscales; completa la ficha fiscal antes de facturar",
      );
    }

    const configuredPlan = parsePaymentPlan(proposal.payment_plan);
    const schedule = paymentScheduleInput.safeParse(proposal.payment_schedule);
    const plan =
      configuredPlan.length > 0
        ? configuredPlan
        : schedule.success
          ? paymentPlanForSchedule(schedule.data)
          : [];
    if (plan.length === 0) {
      throw new Error("Configura los plazos de pago antes de preparar las facturas");
    }

    const allItems = await findProposalItems(proposalId);
    const items = allItems.filter((item) => (item.billing_cycle ?? "none") === "none");
    if (items.length === 0) {
      throw new Error(
        "Esta propuesta solo contiene líneas recurrentes; crea la factura manualmente",
      );
    }

    const [client, series, invoicedPlanIds] = await Promise.all([
      findClientInfo(proposal.client_id),
      findInvoiceSeries(),
      findInvoicedProposalPaymentPlanIds(proposalId),
    ]);
    if (!client || !hasCompleteFiscalData(client)) {
      throw new Error(
        "La propuesta aceptada no tiene datos fiscales; completa la ficha fiscal antes de facturar",
      );
    }
    const ids: string[] = [];
    for (const [index, milestone] of plan.entries()) {
      if (invoicedPlanIds.has(milestone.id)) continue;
      const invoiceItems = splitItemsForPaymentPlan(items, plan, index);
      if (invoiceItems.length === 0) {
        throw new Error(`El plazo «${milestone.title}» no tiene importe facturable`);
      }
      const { subtotal, taxAmount, total } = computeLineTotals(invoiceItems);
      const { id } = await insertInvoiceWithItems(
        {
          client_id: proposal.client_id,
          project_id: proposal.project_id,
          proposal_id: proposal.id,
          proposal_payment_plan_item_id: milestone.id,
          series,
          status: "draft",
          currency: "EUR",
          subtotal,
          tax_amount: taxAmount,
          total,
          due_date: milestone.due_date ?? null,
          client_nif: client?.nif ?? null,
          client_name: client?.name ?? null,
          client_address_street: client?.billing_address_street ?? null,
          client_address_zip: client?.billing_address_zip ?? null,
          client_address_city: client?.billing_address_city ?? null,
          client_address_province: client?.billing_address_province ?? null,
          client_address_country: client?.billing_address_country ?? null,
          notes: proposal.notes,
          payment_terms: `${milestone.title} · ${milestone.percentage} %`,
          created_by: user.id,
        },
        invoiceItems.map((item, position) => ({ ...item, position })),
      );
      ids.push(id);
    }
    return { ids, created: ids.length };
  },
});

/**
 * Lets a commercial hand an accepted proposal to administration without
 * granting access to the financial draft-creation flow.
 */
export const requestInvoiceFromProposal = defineAction<typeof CreateInvoiceFromProposalInput, void>(
  {
    name: "invoices.requestFromProposal",
    schema: CreateInvoiceFromProposalInput,
    revalidate: (_p, input) => [`/proposals/${input.proposalId}`],
    handler: async ({ proposalId }, { user }) => {
      if (user.role === "viewer") throw new Error("No tienes permiso para solicitar facturación");

      const proposal = await findProposalForInvoice(proposalId);
      if (!proposal) throw new Error("Propuesta no encontrada");
      if (proposal.status !== "accepted") {
        throw new Error("Solo se puede solicitar facturación para una propuesta aceptada");
      }

      const supabase = await createServerClient();
      const { data: recipients, error } = await supabase
        .from("team_members")
        .select("id")
        .in("role", ["owner", "admin"])
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      if (!recipients?.length) throw new Error("No hay responsables de administración disponibles");

      await dispatchNotifications({
        recipientIds: recipients.map((member) => member.id as string),
        actorId: user.id,
        eventType: "invoice_requested",
        entityType: "proposal",
        entityId: proposal.id,
        body: `${user.name} solicita facturar «${proposal.title ?? "Propuesta aceptada"}».`,
        link: `/proposals/${proposal.id}`,
      });
    },
  },
);

/**
 * Generates a draft invoice for an hourly project from work logs in a given
 * calendar month. Fixed-price projects are rejected.
 */
export const createHourlyInvoice = defineAction<
  typeof CreateMonthlyHourlyInvoiceInput,
  { id: string }
>({
  name: "invoices.createHourly",
  schema: CreateMonthlyHourlyInvoiceInput,
  revalidate: (_p, input) => ["/invoices", `/projects/${input.projectId}`],
  handler: async (input, { user }) => {
    const { projectId, month } = input;
    const { start: monthStart, end: monthEnd } = getMonthlyBillingWindow(month);
    const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
      new Date(`${monthStart}T00:00:00`),
    );
    const supabase = await createServerClient();
    const { data: id, error } = await supabase.rpc("create_hourly_invoice", {
      p_project_id: projectId,
      p_month_start: monthStart,
      p_month_end: monthEnd,
      p_month_label: monthLabel,
    });
    if (error || !id) throw new Error(error?.message ?? "No se pudo crear la factura por horas");
    log.info({ invoiceId: id, projectId, month, userId: user.id }, "hourly_invoice_created");
    return { id: id as string };
  },
});

// ─── Edit ─────────────────────────────────────────────────────────────────────

/**
 * Patches a draft invoice in place. When `items` is present, line items are
 * replaced and totals recomputed server-side.
 * Locked once the invoice is `issued` or beyond (Verifactu compliance).
 */
export const updateInvoice = defineAction<typeof UpdateInvoiceInputSchema, { version: number }>({
  name: "invoices.update",
  schema: UpdateInvoiceInputSchema,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`],
  handler: async (input) => {
    const current = await findInvoiceForEdit(input.id);
    if (!current) throw new Error("Factura no encontrada");
    if (current.status !== "draft") throw new Error("No se puede editar una factura ya emitida");

    const headerPatch: Record<string, unknown> = {};
    if (input.issue_date) headerPatch.issue_date = input.issue_date;
    if (input.due_date !== undefined) headerPatch.due_date = input.due_date ?? null;
    if (input.notes !== undefined) headerPatch.notes = input.notes;
    if (input.payment_terms !== undefined) headerPatch.payment_terms = input.payment_terms ?? null;

    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc("update_draft_invoice_versioned", {
      p_invoice_id: input.id,
      p_expected_version: input.expected_version,
      p_patch: headerPatch,
      p_items: input.items ?? null,
    });
    if (error) {
      if (error.message === "VERSION_CONFLICT") throw new VersionConflictError();
      throw new Error(error.message);
    }
    const version = Number((data as Array<{ version: number }> | null)?.[0]?.version);
    if (!Number.isSafeInteger(version)) throw new Error("No se pudo confirmar el guardado");
    return { version };
  },
});

// ─── Portal access ────────────────────────────────────────────────────────────

/**
 * Updates the public-link visibility and optional password gate of an invoice.
 * Allowed even after issuance — only fiscal columns are immutable.
 *
 * Implemented as a plain async function (not `defineAction`) because it is
 * consumed by the resource-agnostic `PortalAccessControls` component which
 * expects `(input: unknown) => Promise<{ ok: true } | { ok: false; error }>`.
 */
export async function updateInvoicePortalAccess(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole(["owner", "admin"]);
  } catch {
    return { ok: false, error: "No autorizado" };
  }
  const parsed = UpdatePortalAccessInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }
  const patch = buildPortalAccessPatch(parsed.data);
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createServerClient();
  const { error } = await supabase.from("invoices").update(patch).eq("id", parsed.data.id);
  if (error) {
    log.error({ err: error, id: parsed.data.id }, "update_invoice_portal_access_failed");
    return { ok: false, error: error.message };
  }

  revalidatePath(`/invoices/${parsed.data.id}`);
  return { ok: true };
}

// ─── Rectification ───────────────────────────────────────────────────────────

/**
 * Creates a rectification invoice (factura rectificativa) from an issued invoice.
 * Conforms to RD 1619/2012 art.15 and Verifactu RD 1007/2023.
 *
 * Flow:
 *  1. Validates the original is issued/paid (not draft/cancelled/already-rectified).
 *  2. Clones the line items onto a new draft with series R and the given type (R1/R4).
 *  3. Marks the original as `rectified` so no further rectifications can be issued.
 *
 * The user can edit the draft (amounts, description) before issuing it to AEAT.
 */
export const createRectification = defineAction<typeof CreateRectificationInput, { id: string }>({
  name: "invoices.createRectification",
  schema: CreateRectificationInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.originalInvoiceId}`, "/invoices"],
  handler: async (input) => {
    const { originalInvoiceId, rectificationType, reason } = input;
    const supabase = await createServerClient();
    const { data: id, error } = await supabase.rpc("create_rectification_invoice", {
      p_original_invoice_id: originalInvoiceId,
      p_rectification_type: rectificationType,
      p_reason: reason,
    });
    if (error || !id) throw new Error(error?.message ?? "No se pudo crear la rectificativa");

    log.info(
      { originalInvoiceId, rectificationId: id, rectificationType },
      "rectification_created",
    );

    return { id: id as string };
  },
});

// ─── Send email ───────────────────────────────────────────────────────────────

/**
 * Emails the public portal link to the client via Resend.
 * Requires the invoice to be issued and client-visible.
 */
export const sendInvoiceEmail = defineAction<
  typeof SendInvoiceEmailInput,
  { portalUrl: string; mocked: boolean }
>({
  name: "invoices.sendEmail",
  schema: SendInvoiceEmailInput,
  revalidate: (_p, input) => [`/invoices/${input.id}`],
  handler: async (input, { user }) => {
    const { id, to: overrideTo, message } = input;

    const invoice = await findInvoiceForEmail(id);
    if (!invoice) throw new Error("Factura no encontrada");
    if (invoice.status === "draft")
      throw new Error("Emite la factura antes de enviarla al cliente");
    if (!invoice.is_client_visible) throw new Error("La factura no es visible para el cliente");

    const recipient = overrideTo ?? invoice.client?.email ?? null;
    if (!recipient) throw new Error("El cliente no tiene email registrado");
    if (!invoice.portal_token) throw new Error("La factura no tiene token de portal");

    const invoiceNumber = invoice.full_number ?? "—";
    const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL);
    const portalUrl = `${appUrl}/p/invoice/${invoice.portal_token}`;
    const html = await renderEmail(
      InvoiceEmail({
        clientName: invoice.client?.name ?? "Hola",
        invoiceNumber,
        total: formatEUR(invoice.total ?? 0),
        dueDate: invoice.due_date ? formatDate(invoice.due_date) : "—",
        portalUrl,
        appUrl,
        message,
      }),
    );

    const result = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? "facturacion",
      to: recipient,
      replyTo: user.contactEmail ?? user.email,
      subject: `Factura ${invoiceNumber}`,
      html,
      tags: { invoice_id: id, kind: "invoice_link" },
    });

    return { portalUrl, mocked: result.mocked };
  },
});

// ─── Incobrable (art. 80.Tres LIVA) ──────────────────────────────────────────

/**
 * Marks an invoice as uncollectible (crédito incobrable) per art. 80.Tres LIVA.
 * Requires the invoice to be overdue (unpaid after due date).
 * Sets is_uncollectible = true and uncollectible_at = now().
 *
 * After marking, the company must issue a rectificativa R4 to reclaim VAT.
 * Use createRectification({ rectificationType: 'R4', ... }) for that step.
 */
export const markAsUncollectible = defineAction<typeof MarkUncollectibleInput, { id: string }>({
  name: "invoices.markAsUncollectible",
  schema: MarkUncollectibleInput,
  roles: ["owner", "admin"],
  revalidate: (_p, input) => [`/invoices/${input.id}`, "/invoices"],
  handler: async (input) => {
    const { id } = input;
    const supabase = await createServerClient();

    const { data: inv, error } = await supabase
      .from("invoices")
      .select("status, due_date, is_uncollectible")
      .eq("id", id)
      .maybeSingle();

    if (error || !inv) throw new Error("Factura no encontrada");
    if (inv.is_uncollectible) throw new Error("La factura ya está marcada como incobrable");
    if (!["issued", "overdue"].includes(inv.status as string)) {
      throw new Error(
        "Solo pueden marcarse como incobrables facturas emitidas o vencidas no cobradas",
      );
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("invoices")
      .update({ is_uncollectible: true, uncollectible_at: now, updated_at: now })
      .eq("id", id);

    if (updateErr) throw new Error(updateErr.message);

    log.info({ invoiceId: id }, "invoice_marked_uncollectible");
    return { id };
  },
});
