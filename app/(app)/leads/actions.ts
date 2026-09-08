"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { defineAction } from "@/lib/actions/define-action";
import { VersionConflictError } from "@/lib/concurrency/version-conflict";
import { externalAppUrl } from "@/lib/email/app-url";
import { sendEmail } from "@/lib/email/resend";
import { buildSignatureHtml } from "@/lib/email/signature";
import { appendSignature, markdownToHtml, renderTemplate } from "@/lib/email/templates";
import { addEmailTracking } from "@/lib/email/tracking";
import { isGoogleEnabled, publicEnv, serverEnv } from "@/lib/env";
import type { CalendarBusySlot } from "@/lib/google/calendar";
import { findConflicts, insertEvent } from "@/lib/google/calendar";
import { resolveSubject } from "@/lib/google/client";
import { listLeadGmailMessages, resolveGmailSyncMailboxes } from "@/lib/google/gmail";
import { pushMetaQualifiedLeadStage } from "@/lib/integrations/meta-capi";
import { isAutomaticallyAccessible, summarizeCallOutcomes } from "@/lib/leads/call-qualification";
import {
  CALL_AUTO_FOLLOW_UP,
  CALL_REMINDER_DELAY_MS,
  CALL_REMINDER_DESCRIPTION,
  CALL_REMINDER_NOTIFIED_DESCRIPTION,
  followUpDelayHours,
  normalizePhoneForCall,
  normalizePhoneForWhatsApp,
} from "@/lib/leads/call-workflow";
import { normalizeCompanySize, normalizeLeadSource, normalizeUrgency } from "@/lib/leads/constants";
import {
  buildLeadStatusPatch,
  canAutomateLeadAccessibility,
  isLeadClosureStatus,
} from "@/lib/leads/status-transitions";
import { scopedLogger } from "@/lib/logger";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import {
  AssignLeadOwnerInput,
  CheckMeetingSlotInput,
  ConvertLeadInput,
  CreateLeadInput,
  DeleteLeadInteractionInput,
  LogCallInput,
  LogEmailInput,
  LogNoteInput,
  LogWhatsAppInput,
  type MomTestSignal,
  ScheduleLeadMeetingInput,
  SendEmailToLeadInput,
  StartLeadCallInput,
  SyncLeadGmailInput,
  UpdateLeadCallInput,
  UpdateLeadInput,
  UpdateLeadMomTestInput,
  UpdateLeadStatusInput,
} from "@/lib/schemas/lead";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const log = scopedLogger("leads.actions");

/**
 * Speed-to-lead: stamps `first_contacted_at` on the first real outbound touch
 * (call, logged email, sent email or booked meeting). The
 * `is("first_contacted_at", null)` guard keeps it idempotent and race-safe —
 * only the first contact wins; later touches are no-ops.
 */
async function markFirstContacted(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  leadId: string,
): Promise<void> {
  await supabase
    .from("leads")
    .update({ first_contacted_at: new Date().toISOString() })
    .eq("id", leadId)
    .is("first_contacted_at", null);
}

// ---------------- CREATE ----------------

export const createLead = defineAction<typeof CreateLeadInput, { id: string }>({
  name: "leads.create",
  schema: CreateLeadInput,
  revalidate: (payload) => ["/leads", "/inicio", "/reminders", `/leads/${payload.id}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        ...input,
        assigned_to: input.assigned_to ?? user.id,
        source: normalizeLeadSource(input.source) ?? null,
        company_size: normalizeCompanySize(input.company_size),
        urgency: normalizeUrgency(input.urgency),
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo crear el lead");
    }

    // Manual leads need the same operational safety net as integrated ones:
    // an owner and a first-touch reminder, so none silently enter the board.
    const { error: reminderError } = await supabase.from("tasks").insert({
      kind: "reminder",
      title: `Contactar con ${input.alias?.trim() || input.name}`,
      start_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      lead_id: data.id,
      created_by: user.id,
      assignee_id: input.assigned_to ?? user.id,
      status: "todo",
      priority: "high",
    });
    if (reminderError) {
      log.warn({ err: reminderError, leadId: data.id }, "create_lead_first_touch_reminder_failed");
    }

    return { id: data.id as string };
  },
});

// ---------------- DELETE ----------------

export const deleteLead = defineAction({
  name: "leads.delete",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: () => ["/leads"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  },
});

// ---------------- UPDATE ----------------

export const updateLead = defineAction({
  name: "leads.update",
  schema: UpdateLeadInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.id}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { id, expected_version, ...patch } = input;
    const { data, error } = await supabase
      .from("leads")
      .update({
        ...patch,
        source: normalizeLeadSource(patch.source) ?? null,
        company_size: normalizeCompanySize(patch.company_size),
        urgency: normalizeUrgency(patch.urgency),
        updated_by: user.id,
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

// ---------------- CONVERT TO CLIENT ----------------

/**
 * Converts a lead into a billable client. Creates the `clients` row with
 * fiscal data, links it via `clients.lead_id`, and marks the lead as `won`.
 * Idempotent: if the lead already has a linked client, returns it.
 */
export const convertLeadToClient = defineAction({
  name: "leads.convert",
  schema: ConvertLeadInput,
  handler: async (data) => {
    const supabase = await createServerClient();
    const { data: clientId, error } = await supabase.rpc("convert_lead_to_client", {
      p_lead_id: data.leadId,
      p_name: data.name,
      p_label: data.alias ?? "",
      p_nif: data.nif,
      p_billing_address: data.billing_address,
      p_email: data.email ?? "",
      p_phone: data.phone ?? "",
      p_contact_person: data.contact_person ?? "",
      p_notes: data.notes ?? "",
    });
    if (error || !clientId) throw new Error(error?.message ?? "No se pudo crear el cliente");

    revalidatePath(`/leads/${data.leadId}`);
    revalidatePath("/leads");
    revalidatePath("/clients");

    // Fire-and-forget: push the CRM `won` stage to Meta after response is sent.
    // Uses adminClient to avoid relying on session context inside after().
    const leadId = data.leadId;
    after(async () => {
      try {
        const { data: lead } = await createAdminClient()
          .from("leads")
          .select("email, phone, estimated_value, external_id, external_source")
          .eq("id", leadId)
          .maybeSingle();
        if (lead) {
          await pushMetaQualifiedLeadStage({
            leadId,
            status: "won",
            email: lead.email as string | null,
            phone: lead.phone as string | null,
            value: lead.estimated_value as number | null,
            externalId: lead.external_id as string | null,
            externalSource: lead.external_source as string | null,
          });
        }
      } catch {
        // CAPI is best-effort — never block the conversion
      }
    });

    return { clientId: clientId as string };
  },
});

/**
 * Thin FormData wrapper around `convertLeadToClient` for use with
 * `<form action={...}>`. Throws on validation/DB error so Next.js
 * surfaces it; on success, redirects to the new client.
 */
export async function convertLeadToClientForm(formData: FormData): Promise<void> {
  const result = await convertLeadToClient(formData);
  if (!result.ok) throw new Error(result.error);
  redirect(`/clients/${result.clientId}`);
}

// ---------------- UPDATE STATUS ----------------

export const updateLeadStatus = defineAction({
  name: "leads.updateStatus",
  schema: UpdateLeadStatusInput,
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();

    // Read current status before updating so we can log `from → to`.
    const { data: current } = await supabase
      .from("leads")
      .select("status")
      .eq("id", data.leadId)
      .single();

    if (current?.status === data.status) return;

    const updates = buildLeadStatusPatch({
      status: data.status,
      lostReason: data.lostReason,
      userId: user.id,
      now: new Date().toISOString(),
    });
    const { error } = await supabase.from("leads").update(updates).eq("id", data.leadId);
    if (error) throw new Error(error.message);

    // Log the transition in the interactions timeline.
    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "status_change",
      subject: `Estado: ${current?.status ?? "?"} → ${data.status}`,
      performed_by: user.id,
      payload: {
        from: current?.status ?? null,
        to: data.status,
        lost_reason: data.lostReason ?? null,
      },
    });

    // Fire-and-forget: notify Meta CAPI of every funnel stage transition so
    // the ad algorithm can optimise for lead quality, not just quantity.
    const leadId = data.leadId;
    const status = data.status;
    after(async () => {
      try {
        const { data: lead } = await createAdminClient()
          .from("leads")
          .select("email, phone, external_id, external_source")
          .eq("id", leadId)
          .maybeSingle();
        if (lead) {
          await pushMetaQualifiedLeadStage({
            leadId,
            status,
            email: lead.email as string | null,
            phone: lead.phone as string | null,
            externalId: lead.external_id as string | null,
            externalSource: lead.external_source as string | null,
          });
        }
      } catch (e) {
        log.warn({ err: e, leadId }, "meta_capi_status_failed");
      }
    });
  },
});

/**
 * Removes a closed lead from the recovery queue without reclassifying its
 * commercial outcome. The original closure reason and date remain on the lead
 * so its history can still explain why it was lost.
 */
export const archiveRecoveryLead = defineAction({
  name: "leads.archiveRecovery",
  schema: z.object({ leadId: z.string().uuid() }),
  revalidate: (_payload, input) => ["/leads", "/leads/recovery", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();
    const { data: current, error: currentError } = await supabase
      .from("leads")
      .select("status, lost_reason")
      .eq("id", data.leadId)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);
    if (!current) throw new Error("Lead no encontrado");
    if (!isLeadClosureStatus(current.status)) {
      throw new Error("Solo se pueden quitar de Repesca leads cerrados");
    }

    const { error } = await supabase
      .from("leads")
      .update({ status: "archived", updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);

    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "status_change",
      subject: `Estado: ${current.status} → archived`,
      performed_by: user.id,
      payload: { from: current.status, to: "archived", lost_reason: current.lost_reason },
    });
  },
});

// ---------------- UPDATE ESTIMATED VALUE ----------------

export const updateLeadEstimatedValue = defineAction({
  name: "leads.updateEstimatedValue",
  schema: z.object({
    leadId: z.string().uuid(),
    value: z.number().min(0).max(99_999_999.99).nullable(),
  }),
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("leads")
      .update({ estimated_value: data.value, updated_by: user.id })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
  },
});

// ---------------- UPDATE MOM TEST SIGNAL ----------------

/** Maps a Mom Test signal key to its `leads` table column. */
const MOM_TEST_COLUMN: Record<MomTestSignal, string> = {
  real_problem: "mom_test_real_problem",
  aware_problem: "mom_test_aware_problem",
  tried_solutions: "mom_test_tried_solutions",
  decision_power_or_budget: "mom_test_decision_power_or_budget",
  accessible: "mom_test_accessible",
};

export const updateLeadMomTestSignal = defineAction({
  name: "leads.updateMomTestSignal",
  schema: UpdateLeadMomTestInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();
    const column = MOM_TEST_COLUMN[data.signal];
    const patch: Record<string, boolean | string | null> = {
      [column]: data.value,
      updated_by: user.id,
    };
    if (data.signal === "accessible") patch.mom_test_accessible_source = "manual";
    const { error } = await supabase.from("leads").update(patch).eq("id", data.leadId);
    if (error) throw new Error(error.message);
  },
});

// ---------------- CLAIM (reclamar un lead sin owner) ----------------

/**
 * Assigns an unowned lead to the current member. Guarded by
 * `assigned_to IS NULL` in the UPDATE so two members racing to claim the same
 * lead can't both win — the loser gets a clear error instead of silently
 * overwriting the owner.
 */
export const claimLead = defineAction({
  name: "leads.claim",
  schema: z.object({ leadId: z.string().uuid() }),
  roles: ["owner", "admin", "member"],
  revalidate: () => ["/leads", "/inicio"],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("leads")
      .update({
        assigned_to: user.id,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", input.leadId)
      .is("assigned_to", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Este lead ya tiene responsable.");

    await supabase.from("lead_interactions").insert({
      lead_id: input.leadId,
      type: "note",
      subject: `Lead asignado a ${user.name}`,
      performed_by: user.id,
    });

    return { id: data.id as string };
  },
});

// ---------------- EMAIL ----------------

export const sendEmailToLead = defineAction({
  name: "leads.sendEmail",
  schema: SendEmailToLeadInput,
  handler: async (data, { user }) => {
    if (!user.emailAlias) {
      throw new Error("No tienes un alias configurado en tu perfil.");
    }

    const supabase = await createServerClient();

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, email, company")
      .eq("id", data.leadId)
      .is("deleted_at", null)
      .single();
    if (leadErr || !lead) throw new Error(leadErr?.message ?? "Lead no encontrado");

    const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL);
    const renderedMarkdown = renderTemplate(data.bodyHtml, {
      nombre: lead.name as string,
      empresa: (lead.company as string | null) ?? "",
      email: (lead.email as string | null) ?? "",
      sender_name: user.name,
    });
    const renderedHtml = markdownToHtml(renderedMarkdown);
    const finalHtml = data.includeSignature
      ? appendSignature(
          renderedHtml,
          buildSignatureHtml(
            {
              name: user.name,
              jobTitle: user.jobTitle ?? undefined,
              phone: user.phone ?? undefined,
              contactEmail: user.contactEmail ?? user.emailAlias ?? undefined,
            },
            appUrl,
          ),
        )
      : renderedHtml;

    const renderedSubject = renderTemplate(data.subject, {
      nombre: lead.name as string,
      empresa: (lead.company as string | null) ?? "",
    });

    const { data: campaign, error: campaignErr } = await supabase
      .from("lead_campaigns")
      .insert({
        name: `Email individual · ${lead.name as string}`,
        subject: renderedSubject,
        body_html: finalHtml,
        status: "sending",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (campaignErr || !campaign) {
      throw new Error(campaignErr?.message ?? "No se pudo preparar el tracking del email");
    }

    const { data: sendRow, error: sendErr } = await supabase
      .from("lead_campaign_sends")
      .insert({
        campaign_id: campaign.id as string,
        lead_id: data.leadId,
        email: data.to,
      })
      .select("id, tracking_token")
      .single();
    if (sendErr || !sendRow) {
      throw new Error(sendErr?.message ?? "No se pudo preparar el envío trackeado");
    }

    const trackedHtml = addEmailTracking(finalHtml, appUrl, sendRow.tracking_token as string);

    let cc: string[] | undefined;
    if (data.ccAdmins) {
      const { data: admins, error: adminsError } = await supabase
        .from("team_members")
        .select("email")
        .in("role", ["owner", "admin"])
        .is("deleted_at", null);
      if (adminsError) throw new Error(adminsError.message);

      const recipient = data.to.toLowerCase();
      cc = [
        ...new Set(
          (admins ?? [])
            .map((admin) => admin.email as string)
            .filter((email) => email.toLowerCase() !== recipient),
        ),
      ];
    }

    let resendId: string | null = null;
    let mocked = false;
    try {
      const sent = await sendEmail({
        fromName: user.name,
        fromAlias: user.emailAlias,
        to: data.to,
        cc,
        replyTo: user.email,
        subject: renderedSubject,
        html: trackedHtml,
        tags: { lead_id: data.leadId, campaign_send_id: sendRow.id as string },
      });
      resendId = sent.id;
      mocked = sent.mocked;
    } catch (e) {
      await supabase.from("lead_campaigns").update({ status: "paused" }).eq("id", campaign.id);
      throw new Error(e instanceof Error ? e.message : "Error enviando email");
    }

    await Promise.all([
      supabase
        .from("lead_campaign_sends")
        .update({
          resend_email_id: resendId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", sendRow.id),
      supabase
        .from("lead_campaigns")
        .update({ status: "sent", body_html: trackedHtml })
        .eq("id", campaign.id),
    ]);

    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "email_sent",
      subject: renderedSubject,
      body: trackedHtml,
      resend_email_id: resendId,
      performed_by: user.id,
      payload: {
        template_slug: data.templateSlug ?? null,
        mocked,
        campaign_id: campaign.id,
        campaign_send_id: sendRow.id,
        tracking_token: sendRow.tracking_token,
      },
    });

    await markFirstContacted(supabase, data.leadId);

    revalidatePath(`/leads/${data.leadId}`);
    revalidatePath("/leads/recovery");
    return { emailId: resendId, mocked };
  },
});

// ---------------- LOG INTERACTIONS (call / email / note) ----------------

const CALL_OUTCOME_LABEL: Record<string, string> = {
  connected: "Contactado",
  voicemail: "Buzón de voz",
  no_answer: "Sin respuesta",
  busy: "Comunicando",
  wrong_number: "Número erróneo",
};

/** Creates a durable, self-expiring reminder when the rep starts a call. */
export const startLeadCall = defineAction<typeof StartLeadCallInput, { id: string }>({
  name: "leads.startCall",
  schema: StartLeadCallInput,
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name")
      .eq("id", input.leadId)
      .is("deleted_at", null)
      .single();
    if (leadError || !lead) throw new Error(leadError?.message ?? "Lead no encontrado");

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        kind: "reminder",
        title: `Registrar llamada · ${lead.name as string}`,
        description: CALL_REMINDER_DESCRIPTION,
        start_at: new Date(Date.now() + CALL_REMINDER_DELAY_MS).toISOString(),
        lead_id: input.leadId,
        created_by: user.id,
        assignee_id: user.id,
        status: "todo",
        priority: "medium",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "No se pudo programar el aviso");
    return { id: data.id as string };
  },
});

/**
 * Sends due call reminders without a cron. The app calls this on focus and
 * periodically while open; the task remains durable so the next visit catches
 * up if the browser was closed.
 */
export const notifyDueCallReminders = defineAction({
  name: "leads.notifyDueCallReminders",
  schema: z.object({}),
  handler: async (_input, { user }) => {
    const supabase = await createServerClient();
    const { data: dueTasks } = await supabase
      .from("tasks")
      .select("id, lead_id, title, leads(phone)")
      .eq("kind", "reminder")
      .eq("assignee_id", user.id)
      .eq("status", "todo")
      .eq("description", CALL_REMINDER_DESCRIPTION)
      .lte("start_at", new Date().toISOString())
      .not("lead_id", "is", null)
      .limit(20);

    for (const task of Array.isArray(dueTasks) ? dueTasks : []) {
      const { data: claimed } = await supabase
        .from("tasks")
        .update({ description: CALL_REMINDER_NOTIFIED_DESCRIPTION })
        .eq("id", task.id)
        .eq("description", CALL_REMINDER_DESCRIPTION)
        .select("id")
        .maybeSingle();
      if (!claimed || !task.lead_id) continue;
      const taskLead = Array.isArray(task.leads) ? task.leads[0] : task.leads;

      await dispatchNotifications({
        recipientIds: [user.id],
        eventType: "call_pending",
        entityType: "lead",
        entityId: task.lead_id as string,
        body: `${task.title as string}. Registra el resultado o abre la ficha del lead.`,
        link: `/leads/${task.lead_id as string}?feedback=call`,
        actions: taskLead?.phone
          ? [
              { action: "call", title: "Llamar" },
              { action: "whatsapp", title: "WhatsApp" },
              { action: "feedback", title: "Registrar" },
            ]
          : [{ action: "feedback", title: "Registrar" }],
        data: {
          leadId: task.lead_id as string,
          callUrl: taskLead?.phone ? `tel:${normalizePhoneForCall(taskLead.phone)}` : null,
          whatsappUrl: taskLead?.phone
            ? `https://wa.me/${normalizePhoneForWhatsApp(taskLead.phone)}`
            : null,
          feedbackUrl: `/leads/${task.lead_id as string}?feedback=call`,
        },
      });
    }
  },
});

export const logLeadCall = defineAction<
  typeof LogCallInput,
  {
    noAnswerStreak: number;
    showMomTestPrompt: boolean;
    accessible: boolean | null;
    momTestValues: Record<MomTestSignal, boolean | null>;
  }
>({
  name: "leads.logCall",
  schema: LogCallInput,
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const { leadId, notes, transcript, durationMinutes, outcome, callDate } = data;

    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: leadId,
      type: "call",
      subject: outcome ? `Llamada · ${CALL_OUTCOME_LABEL[outcome]}` : "Llamada",
      body: notes?.trim() || null,
      performed_by: user.id,
      payload: {
        transcript: transcript?.trim() || null,
        duration_minutes: durationMinutes ?? null,
        outcome: outcome ?? null,
        call_date: callDate,
      },
    });
    if (error) throw new Error(error.message);

    // A missed call is an attempt, not a real first contact. A real conversation
    // advances new leads to "contacted" without overwriting later pipeline stages.
    if (outcome === "connected") {
      await markFirstContacted(supabase, leadId);
      const { data: statusUpdated, error: statusError } = await supabase
        .from("leads")
        .update({ status: "contacted", updated_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", leadId)
        .eq("status", "new")
        .select("id")
        .maybeSingle();
      if (statusError) throw new Error(statusError.message);

      if (statusUpdated) {
        await supabase.from("lead_interactions").insert({
          lead_id: leadId,
          type: "status_change",
          subject: "Estado: new → contacted",
          performed_by: user.id,
          payload: { from: "new", to: "contacted" },
        });

        after(async () => {
          try {
            const { data: lead } = await createAdminClient()
              .from("leads")
              .select("email, phone, external_id, external_source")
              .eq("id", leadId)
              .maybeSingle();
            if (lead) {
              await pushMetaQualifiedLeadStage({
                leadId,
                status: "contacted",
                email: lead.email as string | null,
                phone: lead.phone as string | null,
                externalId: lead.external_id as string | null,
                externalSource: lead.external_source as string | null,
              });
            }
          } catch (e) {
            log.warn({ err: e, leadId }, "meta_capi_status_failed");
          }
        });
      }
    }

    await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString(), status: "done" })
      .eq("kind", "reminder")
      .eq("lead_id", leadId)
      .in("description", [CALL_REMINDER_DESCRIPTION, CALL_REMINDER_NOTIFIED_DESCRIPTION])
      .eq("status", "todo")
      .is("completed_at", null);

    // Keep the next attempt alive even when the rep closes the backoffice.
    // This is a durable reminder, not a cron: it becomes visible/pushable the
    // next time the app is open, and never sends anything to the lead.
    const followUpHours = followUpDelayHours(outcome);
    if (followUpHours !== null) {
      await supabase.from("tasks").insert({
        kind: "reminder",
        title: `Reintentar llamada · lead`,
        description: CALL_AUTO_FOLLOW_UP,
        start_at: new Date(Date.now() + followUpHours * 60 * 60 * 1000).toISOString(),
        lead_id: leadId,
        created_by: user.id,
        assignee_id: user.id,
        status: "todo",
        priority: "medium",
      });
    }

    // Count only calls. Other timeline events (notes, emails, etc.) must not
    // affect the unanswered streak or the accessibility qualification.
    const { data: recentCalls, error: callsError } = await supabase
      .from("lead_interactions")
      .select("payload")
      .eq("lead_id", leadId)
      .eq("type", "call")
      .order("created_at", { ascending: false });
    if (callsError) throw new Error(callsError.message);

    const callSummary = summarizeCallOutcomes(Array.isArray(recentCalls) ? recentCalls : []);
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "mom_test_real_problem, mom_test_aware_problem, mom_test_tried_solutions, mom_test_decision_power_or_budget, mom_test_accessible, mom_test_accessible_source",
      )
      .eq("id", leadId)
      .maybeSingle();
    if (leadError || !lead) throw new Error(leadError?.message ?? "Lead no encontrado");

    const currentAccessible = (lead.mom_test_accessible as boolean | null) ?? null;
    const accessibilitySource = lead.mom_test_accessible_source as string | null;
    // A manual decision always wins. Source null + a populated legacy value is
    // also kept untouched, which makes deployment safe even before its backfill.
    const shouldAutomateAccessibility = canAutomateLeadAccessibility({
      value: currentAccessible,
      source: accessibilitySource,
    });
    let accessible = currentAccessible;

    if (shouldAutomateAccessibility) {
      const automaticValue = isAutomaticallyAccessible(callSummary) ? true : null;
      if (automaticValue !== currentAccessible || accessibilitySource !== "auto") {
        const { error: accessibilityError } = await supabase
          .from("leads")
          .update({
            mom_test_accessible: automaticValue,
            mom_test_accessible_source: "auto",
            updated_by: user.id,
          })
          .eq("id", leadId);
        if (accessibilityError) throw new Error(accessibilityError.message);
      }
      accessible = automaticValue;
    }

    const momTestValues: Record<MomTestSignal, boolean | null> = {
      real_problem: (lead.mom_test_real_problem as boolean | null) ?? null,
      aware_problem: (lead.mom_test_aware_problem as boolean | null) ?? null,
      tried_solutions: (lead.mom_test_tried_solutions as boolean | null) ?? null,
      decision_power_or_budget: (lead.mom_test_decision_power_or_budget as boolean | null) ?? null,
      accessible,
    };

    return {
      noAnswerStreak: callSummary.noAnswerStreak,
      showMomTestPrompt:
        outcome === "connected" &&
        callSummary.connected === 1 &&
        Object.values(momTestValues).some((value) => value === null),
      accessible,
      momTestValues,
    };
  },
});

function interactionPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export const updateLeadCall = defineAction({
  name: "leads.updateCall",
  schema: UpdateLeadCallInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data) => {
    const supabase = await createServerClient();
    const { data: interaction, error: readError } = await supabase
      .from("lead_interactions")
      .select("type, payload")
      .eq("id", data.interactionId)
      .eq("lead_id", data.leadId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!interaction || interaction.type !== "call") throw new Error("Llamada no encontrada");

    const { error } = await supabase
      .from("lead_interactions")
      .update({
        subject: data.outcome ? `Llamada · ${CALL_OUTCOME_LABEL[data.outcome]}` : "Llamada",
        body: data.notes?.trim() || null,
        payload: {
          ...interactionPayload(interaction.payload),
          transcript: data.transcript?.trim() || null,
          duration_minutes: data.durationMinutes ?? null,
          outcome: data.outcome ?? null,
          call_date: data.callDate,
        },
      })
      .eq("id", data.interactionId)
      .eq("lead_id", data.leadId);
    if (error) throw new Error(error.message);
  },
});

export const logLeadEmail = defineAction({
  name: "leads.logEmail",
  schema: LogEmailInput,
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const { leadId, direction, subject, bodyHtml, counterparty } = data;

    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: leadId,
      type: direction === "incoming" ? "email_received" : "email_sent",
      subject,
      body: bodyHtml?.trim() || null,
      performed_by: user.id,
      payload: { manual: true, direction, counterparty: counterparty ?? null },
    });
    if (error) throw new Error(error.message);

    await markFirstContacted(supabase, leadId);
  },
});

// ---------------- GMAIL SYNC ----------------

/**
 * Imports the most recent Gmail messages involving this lead from the approved
 * commercial mailboxes. Database uniqueness constraints make retries safe.
 */
export const syncLeadGmail = defineAction<
  typeof SyncLeadGmailInput,
  { imported: number; scanned: number; unavailableMailboxes: string[] }
>({
  name: "leads.syncGmail",
  schema: SyncLeadGmailInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async ({ leadId }) => {
    if (!isGoogleEnabled()) throw new Error("Google Workspace no está configurado");

    const supabase = await createServerClient();
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, email")
      .eq("id", leadId)
      .is("deleted_at", null)
      .single();
    if (leadError || !lead) throw new Error(leadError?.message ?? "Lead no encontrado");
    if (!lead.email) throw new Error("Este lead no tiene email registrado.");

    const [{ data: members, error: membersError }, { data: settings, error: settingsError }] =
      await Promise.all([
        supabase.from("team_members").select("email").is("deleted_at", null),
        supabase.from("settings").select("gmail_sync_mailboxes").eq("id", 1).maybeSingle(),
      ]);
    if (membersError) throw new Error(membersError.message);
    if (settingsError) throw new Error(settingsError.message);

    const generalMailboxes = Array.isArray(settings?.gmail_sync_mailboxes)
      ? settings.gmail_sync_mailboxes
      : [];
    const mailboxes = resolveGmailSyncMailboxes(
      (members ?? []).map((member) => member.email),
      generalMailboxes,
      serverEnv().GOOGLE_WORKSPACE_DOMAIN,
    );
    if (mailboxes.length === 0) {
      throw new Error("No hay buzones de Gmail configurados para sincronizar.");
    }

    const source = await listLeadGmailMessages(lead.email.toLowerCase(), mailboxes);
    if (source.synchronizedMailboxes === 0) {
      throw new Error(
        "No se pudo acceder a Gmail. Comprueba que la Gmail API y su permiso están autorizados.",
      );
    }

    let imported = 0;
    const sentDates: string[] = [];
    for (const message of source.messages) {
      if (message.direction === "outgoing") sentDates.push(message.createdAt);
      const { error } = await supabase.from("lead_interactions").insert({
        lead_id: leadId,
        type: message.direction === "outgoing" ? "email_sent" : "email_received",
        subject: message.subject,
        body: message.body,
        created_at: message.createdAt,
        gmail_mailbox: message.mailbox,
        gmail_message_id: message.gmailMessageId,
        gmail_thread_id: message.gmailThreadId,
        gmail_rfc_message_id: message.rfcMessageId,
        payload: {
          source: "gmail_sync",
          mailbox: message.mailbox,
          gmail_thread_id: message.gmailThreadId,
          from: message.from,
          to: message.to,
          cc: message.cc,
        },
      });
      if (!error) {
        imported++;
        continue;
      }
      // Both Gmail id and RFC Message-ID have uniqueness guards. A duplicate
      // means this message was already visible in the lead history.
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }

    const firstSentAt = sentDates.sort()[0];
    if (firstSentAt) {
      await supabase
        .from("leads")
        .update({ first_contacted_at: firstSentAt })
        .eq("id", leadId)
        .is("first_contacted_at", null);
    }

    return {
      imported,
      scanned: source.scanned,
      unavailableMailboxes: source.unavailableMailboxes,
    };
  },
});

export const logLeadNote = defineAction({
  name: "leads.logNote",
  schema: LogNoteInput,
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const { leadId, content } = data;

    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: leadId,
      type: "note",
      body: content.trim(),
      performed_by: user.id,
    });
    if (error) throw new Error(error.message);
  },
});

/**
 * Records a WhatsApp message only after the operator confirms it was sent in
 * WhatsApp. It remains a `note` until the interaction enum is migrated.
 */
export const logLeadWhatsApp = defineAction({
  name: "leads.logWhatsApp",
  schema: LogWhatsAppInput,
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async ({ leadId, content }, { user }) => {
    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: leadId,
      type: "note",
      subject: "WhatsApp enviado",
      body: content.trim(),
      performed_by: user.id,
      payload: { manual: true, channel: "whatsapp", direction: "outgoing" },
    });
    if (error) throw new Error(error.message);

    await markFirstContacted(supabase, leadId);
  },
});

export const deleteLeadInteraction = defineAction({
  name: "leads.deleteInteraction",
  schema: DeleteLeadInteractionInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data) => {
    const supabase = await createServerClient();
    const { data: interaction, error: readError } = await supabase
      .from("lead_interactions")
      .select("type")
      .eq("id", data.interactionId)
      .eq("lead_id", data.leadId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!interaction || (interaction.type !== "call" && interaction.type !== "note")) {
      throw new Error("Solo se pueden eliminar llamadas y notas manuales");
    }

    const { error } = await supabase
      .from("lead_interactions")
      .delete()
      .eq("id", data.interactionId)
      .eq("lead_id", data.leadId);
    if (error) throw new Error(error.message);
  },
});

// ---------------- ASSIGN OWNER ----------------

/**
 * Assigns (or clears) the team member responsible for a lead and records the
 * change in the interactions timeline as `owner_change`, so the history shows
 * who took ownership and when. No-ops when the owner is unchanged.
 */
export const assignLeadOwner = defineAction({
  name: "leads.assignOwner",
  schema: AssignLeadOwnerInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();

    const { data: current } = await supabase
      .from("leads")
      .select("assigned_to, name, phone")
      .eq("id", data.leadId)
      .single();

    const previousId = (current?.assigned_to as string | null) ?? null;
    const nextId = data.assigneeId ?? null;
    if (previousId === nextId) return;

    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: nextId, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);

    // Resolve names for a readable `from → to` timeline entry.
    const ids = [previousId, nextId].filter((v): v is string => v !== null);
    const nameById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: members } = await supabase
        .from("team_members")
        .select("id, name")
        .in("id", ids);
      for (const m of members ?? []) nameById.set(m.id as string, (m.name as string) ?? "");
    }
    const label = (id: string | null) => (id ? (nameById.get(id) ?? "?") : "Sin asignar");

    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "owner_change",
      subject: `Responsable: ${label(previousId)} → ${label(nextId)}`,
      performed_by: user.id,
      payload: { from: previousId, to: nextId },
    });

    if (nextId && nextId !== user.id) {
      await dispatchNotifications({
        recipientIds: [nextId],
        actorId: user.id,
        eventType: "lead_assigned",
        entityType: "lead",
        entityId: data.leadId,
        body: `Te han asignado el lead “${(current?.name as string | null) ?? "Sin nombre"}”`,
        link: `/leads/${data.leadId}`,
        actions: (current?.phone as string | null)
          ? [
              { action: "call", title: "Llamar" },
              { action: "whatsapp", title: "WhatsApp" },
              { action: "feedback", title: "Registrar" },
            ]
          : [{ action: "feedback", title: "Registrar" }],
        data: {
          callUrl: current?.phone ? `tel:${normalizePhoneForCall(current.phone as string)}` : null,
          whatsappUrl: current?.phone
            ? `https://wa.me/${normalizePhoneForWhatsApp(current.phone as string)}`
            : null,
          feedbackUrl: `/leads/${data.leadId}?feedback=call`,
        },
      });
    }
  },
});

// ---------------- CALENDAR (Google Workspace) ----------------

/**
 * Step 1 — Check for conflicts on the shared calendar without creating anything.
 * Returns the overlapping events so the user can decide whether to proceed.
 */
export const checkLeadMeetingSlot = defineAction({
  name: "leads.checkMeetingSlot",
  schema: CheckMeetingSlotInput,
  roles: ["owner", "admin", "member"],
  handler: async (data, { user }): Promise<{ conflicts: CalendarBusySlot[] }> => {
    if (!isGoogleEnabled()) return { conflicts: [] };
    const calendarId = serverEnv().GOOGLE_CALENDAR_ID;
    if (!calendarId) return { conflicts: [] };
    const subject = resolveSubject(user.email);

    const conflicts = await findConflicts({
      subject,
      calendarId,
      start: new Date(data.start),
      end: new Date(data.end),
    });
    return { conflicts };
  },
});

/**
 * Step 2 — Create the meeting on the shared calendar and record it as a
 * `meeting` interaction in the lead timeline.
 */
export const scheduleLeadMeeting = defineAction<
  typeof ScheduleLeadMeetingInput,
  { eventId: string; htmlLink: string | null; meetUrl: string | null }
>({
  name: "leads.scheduleMeeting",
  schema: ScheduleLeadMeetingInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    if (!isGoogleEnabled()) throw new Error("Google Workspace no está configurado");
    const calendarId = serverEnv().GOOGLE_CALENDAR_ID;
    if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID no configurado");
    const subject = resolveSubject(user.email);
    const attendeeEmails = [...new Set([...(data.attendeeEmails ?? []), user.email])];

    const event = await insertEvent({
      subject,
      calendarId,
      summary: data.title,
      description: data.description,
      start: new Date(data.start),
      end: new Date(data.end),
      attendees: attendeeEmails,
      withMeet: data.withMeet,
    });

    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "meeting",
      subject: data.title,
      body: data.description ?? null,
      performed_by: user.id,
      project_id: data.projectId ?? null,
      payload: {
        calendar_event_id: event.id,
        calendar_html_link: event.htmlLink,
        meet_url: event.meetUrl,
        start: data.start,
        end: data.end,
        attendees: attendeeEmails,
      },
    });
    if (error) throw new Error(error.message);

    // A booked Meet must also become a durable next action; the calendar event
    // alone is not queried by the lead board or its commercial agenda.
    const { error: reminderError } = await supabase.from("tasks").insert({
      kind: "reminder",
      action_type: "meeting",
      title: data.title,
      description: data.description ?? null,
      start_at: data.start,
      lead_id: data.leadId,
      project_id: data.projectId ?? null,
      created_by: user.id,
      assignee_id: user.id,
      status: "todo",
      priority: "medium",
    });
    if (reminderError) {
      log.warn({ err: reminderError, leadId: data.leadId }, "schedule_meeting_reminder_failed");
    }

    await markFirstContacted(supabase, data.leadId);

    return { eventId: event.id, htmlLink: event.htmlLink, meetUrl: event.meetUrl };
  },
});
