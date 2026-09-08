/**
 * leads/actions.test.ts – Server Actions E2E
 *
 * Tests the full server-action pipeline (auth guard → validation → DB → revalidate)
 * using mocked Supabase and auth layer. No real DB or network needed.
 *
 * Covered actions:
 *  - createLead    → inserts row, fires background notification, returns id
 *  - deleteLead    → soft-deletes; enforces owner/admin role restriction
 *  - updateLead    → patches fields; available to member+
 *  - updateLeadStatus → updates status + logs interaction in timeline
 *  - claimLead     → assigns unowned lead; errors on already-owned
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── shared DB state ───────────────────────────────────────────────────────────

const { db, authUser, googleCalendar, sendEmail } = vi.hoisted(() => ({
  db: {
    insertedRows: [] as Record<string, unknown>[],
    updatedRows: [] as Record<string, unknown>[],
    queryError: null as string | null,
    leadStatus: "new" as string,
    recentCallPayloads: [] as Array<{ payload: { outcome?: string | null } }>,
    leadMomTest: {
      mom_test_real_problem: null as boolean | null,
      mom_test_aware_problem: null as boolean | null,
      mom_test_tried_solutions: null as boolean | null,
      mom_test_decision_power_or_budget: null as boolean | null,
      mom_test_accessible: null as boolean | null,
      mom_test_accessible_source: null as string | null,
    },
    adminEmails: [{ email: "admin@doscientos.es" }, { email: "owner@doscientos.es" }],
  },
  authUser: {
    id: "member-1",
    name: "Pol",
    email: "pol@doscientos.es",
    role: "admin" as "owner" | "admin" | "member" | "viewer",
    avatarUrl: null,
    emailAlias: null as string | null,
    githubHandle: null,
    onboardedAt: "2024-01-01",
    jobTitle: null,
    phone: null,
    contactEmail: null,
  },
  googleCalendar: {
    findConflicts: vi.fn(),
    insertEvent: vi.fn(),
  },
  sendEmail: vi.fn(),
}));

// ── mocks ─────────────────────────────────────────────────────────────────────

/**
 * Supabase builder mock.
 *
 * Every method returns the SAME builder so the call chain can be arbitrarily
 * deep (`.update().eq().is().select().maybeSingle()`). The builder is also a
 * thenable so `await builder.update({}).eq(...)` resolves correctly.
 */
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      // Resolved value for terminal awaits (.single, .maybeSingle, or direct await)
      let selectedColumns = "";
      const resolve = () => {
        if (db.queryError) return { data: null, error: { message: db.queryError } };
        if (table === "lead_interactions" && selectedColumns === "payload") {
          return { data: db.recentCallPayloads, error: null };
        }
        if (table === "leads" && selectedColumns.includes("mom_test_accessible")) {
          return { data: db.leadMomTest, error: null };
        }
        if (table === "team_members") return { data: db.adminEmails, error: null };
        return {
          data:
            table === "leads"
              ? { id: "new-lead-uuid", name: "Lead Test", status: db.leadStatus }
              : table === "lead_campaign_sends"
                ? { id: "campaign-send-uuid", tracking_token: "tracking-token" }
                : { id: "interaction-uuid" },
          error: null,
        };
      };

      // Builder: all chainable methods return itself; terminal methods are async.
      const builder: Record<string, unknown> = {
        insert(row: Record<string, unknown>) {
          db.insertedRows.push({ table, ...row });
          if (table === "lead_interactions" && row.type === "call") {
            db.recentCallPayloads.unshift({ payload: row.payload as { outcome?: string | null } });
          }
          return builder;
        },
        update(patch: Record<string, unknown>) {
          db.updatedRows.push({ table, ...patch });
          return builder;
        },
        select(columns?: string) {
          selectedColumns = columns ?? "";
          return builder;
        },
        eq() {
          return builder;
        },
        is() {
          return builder;
        },
        in() {
          return builder;
        },
        not() {
          return builder;
        },
        lte() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        async single() {
          return resolve();
        },
        async maybeSingle() {
          if (table === "leads" && selectedColumns.includes("mom_test_accessible"))
            return resolve();
          if (table === "leads" && selectedColumns === "status, lost_reason") return resolve();
          if (table === "leads" && db.queryError)
            return { data: null, error: { message: db.queryError } };
          // claimLead checks `.is("assigned_to", null)` → return a row with id
          return { data: { id: "lead-1" }, error: null };
        },
        // Makes `await builder` work (thenable protocol).
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable for Supabase mock
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve(resolve()).then(onFulfilled);
        },
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => authUser,
  requireRole: async (roles: string[]) => {
    if (!roles.includes(authUser.role)) {
      const err = new Error("Forbidden") as Error & { digest?: string };
      err.digest = "NEXT_REDIRECT";
      throw err;
    }
    return authUser;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => fn(), // execute inline in tests
}));
vi.mock("@/lib/integrations/notify-new-lead", () => ({
  notifyNewLead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/meta-capi", () => ({
  pushMetaConversion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { email: "lead@test.com", phone: null }, error: null }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/lib/env", () => ({
  isGoogleEnabled: () => true,
  publicEnv: { NEXT_PUBLIC_APP_URL: "https://app.example.com" },
  serverEnv: () => ({ GOOGLE_CALENDAR_ID: "team-calendar" }),
}));
vi.mock("@/lib/google/calendar", () => googleCalendar);
vi.mock("@/lib/google/client", () => ({ resolveSubject: () => "pol@doscientos.es" }));
vi.mock("@/lib/email/resend", () => ({ sendEmail }));

// ── SUT ───────────────────────────────────────────────────────────────────────

import {
  archiveRecoveryLead,
  claimLead,
  createLead,
  deleteLead,
  logLeadCall,
  logLeadWhatsApp,
  scheduleLeadMeeting,
  sendEmailToLead,
  updateLead,
  updateLeadMomTestSignal,
  updateLeadStatus,
} from "@/app/(app)/leads/actions";

// ── helpers ───────────────────────────────────────────────────────────────────

function lead(overrides?: Record<string, unknown>) {
  return {
    name: "Empresa Test",
    source: "manual" as const,
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  db.insertedRows = [];
  db.updatedRows = [];
  db.queryError = null;
  db.leadStatus = "new";
  db.recentCallPayloads = [];
  db.leadMomTest = {
    mom_test_real_problem: null,
    mom_test_aware_problem: null,
    mom_test_tried_solutions: null,
    mom_test_decision_power_or_budget: null,
    mom_test_accessible: null,
    mom_test_accessible_source: null,
  };
  db.adminEmails = [{ email: "admin@doscientos.es" }, { email: "owner@doscientos.es" }];
  authUser.role = "admin";
  authUser.emailAlias = "pol";
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ id: "resend-email-1", mocked: false });
  googleCalendar.insertEvent.mockResolvedValue({
    id: "calendar-event-1",
    htmlLink: "https://calendar.google.com/event-1",
    meetUrl: "https://meet.google.com/abc-defg-hij",
  });
});

describe("createLead", () => {
  it("returns ok:true with the new lead id", async () => {
    const result = await createLead(lead());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe("new-lead-uuid");
  });

  it("includes created_by from the authenticated user", async () => {
    await createLead(lead());
    const inserted = db.insertedRows.find((r) => r.table === "leads");
    expect(inserted?.created_by).toBe("member-1");
  });

  it("assigns the creator and schedules the first contact for manual intake", async () => {
    await createLead(lead());

    expect(db.insertedRows.find((r) => r.table === "leads")).toMatchObject({
      assigned_to: "member-1",
    });
    expect(db.insertedRows.find((r) => r.table === "tasks")).toMatchObject({
      kind: "reminder",
      lead_id: "new-lead-uuid",
      assignee_id: "member-1",
      priority: "high",
    });
  });

  it("returns ok:false with a message when the DB fails", async () => {
    db.queryError = "duplicate key";
    const result = await createLead(lead());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate key");
  });

  it("fails validation when name is missing", async () => {
    const result = await createLead({} as Parameters<typeof createLead>[0]);
    expect(result.ok).toBe(false);
  });
});

describe("deleteLead", () => {
  it("succeeds for admin role", async () => {
    authUser.role = "admin";
    const result = await deleteLead({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(true);
  });

  it("is restricted to owner/admin (throws redirect for member)", async () => {
    authUser.role = "member";
    // requireRole throws a framework error → defineAction re-throws it
    await expect(deleteLead({ id: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow();
  });

  it("fails validation when id is not a UUID", async () => {
    const result = await deleteLead({ id: "not-a-uuid" });
    expect(result.ok).toBe(false);
  });
});

describe("updateLead", () => {
  it("returns ok:true for a valid patch", async () => {
    const result = await updateLead({
      id: "00000000-0000-0000-0000-000000000001",
      expected_version: 1,
      name: "Updated Name",
    });
    expect(result.ok).toBe(true);
  });

  it("sets updated_by to the current user", async () => {
    await updateLead({
      id: "00000000-0000-0000-0000-000000000001",
      expected_version: 1,
      name: "X",
    });
    const row = db.updatedRows.find((r) => r.table === "leads");
    expect(row?.updated_by).toBe("member-1");
  });
});

describe("updateLeadStatus", () => {
  it("returns ok:true when the update succeeds", async () => {
    const result = await updateLeadStatus({
      leadId: "00000000-0000-0000-0000-000000000001",
      status: "qualifying",
    });
    expect(result.ok).toBe(true);
  });

  it("sets lost_reason when closing as lost", async () => {
    await updateLeadStatus({
      leadId: "00000000-0000-0000-0000-000000000001",
      status: "lost",
      lostReason: "Budget no fit",
    });
    const row = db.updatedRows.find((r) => r.table === "leads");
    expect(row?.lost_reason).toBe("Budget no fit");
  });

  it("clears lost_reason when re-opening", async () => {
    await updateLeadStatus({
      leadId: "00000000-0000-0000-0000-000000000001",
      status: "qualifying",
    });
    const row = db.updatedRows.find((r) => r.table === "leads");
    expect(row?.lost_reason).toBeNull();
  });
});

describe("archiveRecoveryLead", () => {
  it("archives a closed lead without clearing its recorded loss details", async () => {
    db.leadStatus = "lost";

    const result = await archiveRecoveryLead({
      leadId: "00000000-0000-0000-0000-000000000001",
    });

    expect(result.ok).toBe(true);
    const patch = db.updatedRows.find((row) => row.table === "leads");
    expect(patch).toMatchObject({ status: "archived", updated_by: "member-1" });
    expect(patch).not.toHaveProperty("lost_reason");
    expect(patch).not.toHaveProperty("lost_at");
  });

  it("rejects an active lead", async () => {
    const result = await archiveRecoveryLead({
      leadId: "00000000-0000-0000-0000-000000000001",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "Solo se pueden quitar de Repesca leads cerrados",
    });
  });
});

describe("claimLead", () => {
  it("returns ok:true when lead has no owner", async () => {
    const result = await claimLead({ leadId: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(true);
  });
});

describe("sendEmailToLead", () => {
  it("copies active owners and admins for a post-call email", async () => {
    const result = await sendEmailToLead({
      leadId: "00000000-0000-0000-0000-000000000001",
      to: "lead@example.com",
      subject: "Resumen de nuestra llamada",
      bodyHtml: "Gracias por tu tiempo.",
      ccAdmins: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lead@example.com",
        cc: ["admin@doscientos.es", "owner@doscientos.es"],
      }),
    );
  });
});

describe("logLeadCall", () => {
  it("stores notes, transcript and call metadata for the digest context", async () => {
    const result = await logLeadCall({
      leadId: "00000000-0000-0000-0000-000000000001",
      notes: "Pide propuesta esta semana.",
      transcript: "Comentamos alcance y presupuesto.",
      durationMinutes: 25,
      outcome: "connected",
      callDate: "2026-08-10",
    });

    expect(result.ok).toBe(true);
    expect(db.insertedRows.find((row) => row.table === "lead_interactions")).toMatchObject({
      lead_id: "00000000-0000-0000-0000-000000000001",
      type: "call",
      body: "Pide propuesta esta semana.",
      payload: {
        transcript: "Comentamos alcance y presupuesto.",
        duration_minutes: 25,
        outcome: "connected",
        call_date: "2026-08-10",
      },
    });
    expect(db.updatedRows).toContainEqual(
      expect.objectContaining({ table: "leads", status: "contacted", updated_by: "member-1" }),
    );
    expect(db.insertedRows).toContainEqual(
      expect.objectContaining({
        table: "lead_interactions",
        type: "status_change",
        payload: { from: "new", to: "contacted" },
      }),
    );
    expect(result).toMatchObject({
      showMomTestPrompt: true,
      accessible: true,
      momTestValues: {
        real_problem: null,
        aware_problem: null,
        tried_solutions: null,
        decision_power_or_budget: null,
        accessible: true,
      },
    });
    expect(db.updatedRows).toContainEqual(
      expect.objectContaining({
        table: "leads",
        mom_test_accessible: true,
        mom_test_accessible_source: "auto",
      }),
    );
  });

  it("keeps a new lead unchanged when the call is unanswered", async () => {
    await logLeadCall({
      leadId: "00000000-0000-0000-0000-000000000001",
      outcome: "no_answer",
    });

    expect(db.updatedRows.some((row) => row.table === "leads" && row.status === "contacted")).toBe(
      false,
    );
  });

  it("never overwrites a manually decided accessibility signal", async () => {
    db.leadMomTest.mom_test_accessible = false;
    db.leadMomTest.mom_test_accessible_source = "manual";

    await logLeadCall({
      leadId: "00000000-0000-0000-0000-000000000001",
      outcome: "connected",
    });

    expect(db.updatedRows.some((row) => row.mom_test_accessible === true)).toBe(false);
  });

  it("keeps existing Mom Test answers and skips the prompt when all are complete", async () => {
    db.leadMomTest = {
      mom_test_real_problem: true,
      mom_test_aware_problem: true,
      mom_test_tried_solutions: false,
      mom_test_decision_power_or_budget: true,
      mom_test_accessible: false,
      mom_test_accessible_source: "manual",
    };

    const result = await logLeadCall({
      leadId: "00000000-0000-0000-0000-000000000001",
      notes: "Primera conversación registrada.",
      outcome: "connected",
    });

    expect(result).toMatchObject({
      ok: true,
      showMomTestPrompt: false,
      momTestValues: {
        real_problem: true,
        aware_problem: true,
        tried_solutions: false,
        decision_power_or_budget: true,
        accessible: false,
      },
    });
  });

  it("marks an accessibility selection as manual", async () => {
    await updateLeadMomTestSignal({
      leadId: "00000000-0000-0000-0000-000000000001",
      signal: "accessible",
      value: false,
    });

    expect(db.updatedRows).toContainEqual(
      expect.objectContaining({
        table: "leads",
        mom_test_accessible: false,
        mom_test_accessible_source: "manual",
      }),
    );
  });
});

describe("logLeadWhatsApp", () => {
  it("records the confirmed message with its author and channel metadata", async () => {
    const result = await logLeadWhatsApp({
      leadId: "00000000-0000-0000-0000-000000000001",
      content: "  Hola, te envío el resumen.  ",
    });

    expect(result.ok).toBe(true);
    expect(db.insertedRows).toContainEqual(
      expect.objectContaining({
        table: "lead_interactions",
        type: "note",
        subject: "WhatsApp enviado",
        body: "Hola, te envío el resumen.",
        performed_by: "member-1",
        payload: { manual: true, channel: "whatsapp", direction: "outgoing" },
      }),
    );
    expect(db.updatedRows).toContainEqual(
      expect.objectContaining({ table: "leads", first_contacted_at: expect.any(String) }),
    );
  });
});

describe("scheduleLeadMeeting", () => {
  it("adds the member who schedules it as an attendee", async () => {
    const result = await scheduleLeadMeeting({
      leadId: "00000000-0000-0000-0000-000000000001",
      title: "Reunión con Acme",
      start: "2026-08-10T10:00:00.000Z",
      end: "2026-08-10T11:00:00.000Z",
      attendeeEmails: ["lead@example.com"],
      withMeet: true,
    });

    expect(result).toMatchObject({ ok: true, meetUrl: "https://meet.google.com/abc-defg-hij" });
    expect(googleCalendar.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ attendees: ["lead@example.com", "pol@doscientos.es"] }),
    );
  });
});
