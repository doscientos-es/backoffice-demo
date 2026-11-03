"use server";

import { z } from "zod";

import { defineAction } from "@/lib/actions/define-action";
import { VersionConflictError } from "@/lib/concurrency/version-conflict";
import {
  generateNextSubscriptionInvoice,
  generateSubscriptionInvoices,
} from "@/lib/subscriptions/generate-invoices";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const subscriptionFields = z.object({
  client_id: z.string().uuid("Cliente requerido"),
  project_id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(1, "Nombre requerido").max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
  billing_cycle: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
  amount: z.coerce.number().min(0, "Importe requerido"),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
  start_date: z.string().date(),
  end_date: z.string().date().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

const subscriptionSchema = subscriptionFields.refine(
  (d) => !d.end_date || d.end_date >= d.start_date,
  {
    message: "La fecha de fin no puede ser anterior al inicio",
    path: ["end_date"],
  },
);

const updateSubscriptionSchema = subscriptionFields
  .extend({
    id: z.string().uuid(),
    expected_version: z.coerce.number().int().positive(),
  })
  .refine((d) => !d.end_date || d.end_date >= d.start_date, {
    message: "La fecha de fin no puede ser anterior al inicio",
    path: ["end_date"],
  });

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export const createSubscription = defineAction({
  name: "subscriptions.create",
  schema: subscriptionSchema,
  roles: ["owner", "admin", "member"],
  revalidate: ["/subscriptions"],
  async handler(input) {
    const supabase = await createServerClient();
    const { error } = await supabase.from("subscriptions").insert({
      ...input,
      // Internal cursor managed by the recurring-billing job. The first
      // invoice is due on the subscription start date.
      next_invoice_date: input.start_date,
      project_id: input.project_id || null,
      end_date: input.end_date || null,
    });
    if (error) throw new Error(error.message);
  },
});

export const updateSubscription = defineAction({
  name: "subscriptions.update",
  schema: updateSubscriptionSchema,
  roles: ["owner", "admin", "member"],
  revalidate: (_, input) => ["/subscriptions", `/subscriptions/${input.id}`],
  async handler({ id, expected_version, ...rest }) {
    const supabase = await createServerClient();
    const { data: current, error: currentError } = await supabase
      .from("subscriptions")
      .select("status, next_invoice_date")
      .eq("id", id)
      .eq("version", expected_version)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) throw new VersionConflictError();

    const today = new Date().toISOString().slice(0, 10);
    const nextInvoiceDate =
      rest.status === "active" &&
      current.status !== "active" &&
      current.next_invoice_date &&
      current.next_invoice_date < today
        ? today
        : undefined;

    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        ...rest,
        project_id: rest.project_id || null,
        end_date: rest.end_date || null,
        ...(nextInvoiceDate ? { next_invoice_date: nextInvoiceDate } : {}),
      })
      .eq("id", id)
      .eq("version", expected_version)
      .select("version")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new VersionConflictError();
    return { version: Number(data.version) };
  },
});

export const generateSubscriptionInvoicesNow = defineAction({
  name: "subscriptions.generate-invoices",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin", "member"],
  revalidate: (_, input) => [
    "/subscriptions",
    `/subscriptions/${input.id}`,
    "/invoices",
  ],
  async handler({ id }) {
    // Verify the subscription is visible to the user before using the admin client.
    const supabase = await createServerClient();
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Suscripción no encontrada");
    if (sub.status !== "active") {
      throw new Error(
        "Solo se pueden generar facturas de suscripciones activas",
      );
    }

    const result = await generateSubscriptionInvoices(id);
    if (result.failures.length > 0) throw new Error(result.failures[0]!.error);
    return { generatedCount: result.generated.length };
  },
});

export const generateNextSubscriptionInvoiceDraft = defineAction({
  name: "subscriptions.generate-next-invoice",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin", "member"],
  revalidate: (_, input) => [
    "/subscriptions",
    `/subscriptions/${input.id}`,
    "/invoices",
  ],
  async handler({ id }) {
    const supabase = await createServerClient();
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Suscripción no encontrada");
    if (sub.status !== "active") {
      throw new Error(
        "Solo se pueden generar facturas de suscripciones activas",
      );
    }

    const invoiceId = await generateNextSubscriptionInvoice(id);
    if (!invoiceId)
      throw new Error("No hay ningún período pendiente de facturar");
    return { invoiceId };
  },
});

export const deleteSubscription = defineAction({
  name: "subscriptions.delete",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: ["/subscriptions"],
  async handler({ id }) {
    const supabase = await createServerClient();
    // Also mark as cancelled so status reflects reality before the record
    // disappears from active queries.
    const { error } = await supabase
      .from("subscriptions")
      .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
});

export const restoreSubscription = defineAction({
  name: "subscriptions.restore",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: ["/subscriptions"],
  async handler({ id }) {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
});
