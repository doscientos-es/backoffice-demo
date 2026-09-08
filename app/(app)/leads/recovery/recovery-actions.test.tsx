import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { archiveRecoveryLead, refresh } = vi.hoisted(() => ({
  archiveRecoveryLead: vi.fn().mockResolvedValue({ ok: true }),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../actions", () => ({ archiveRecoveryLead, updateLeadStatus: vi.fn() }));
vi.mock("../[id]/email-composer", () => ({ EmailComposer: () => null }));
vi.mock("../close-reason-dialog", () => ({ CloseReasonDialog: () => null }));
vi.mock("../reopen-confirm-dialog", () => ({ ReopenConfirmDialog: () => null }));
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        {confirmLabel}
      </button>
    ) : null,
}));

import { RecoveryActions } from "./recovery-actions";

describe("RecoveryActions", () => {
  it("archives a closed lead after confirming that it should leave Repesca", async () => {
    render(
      <RecoveryActions
        lead={{
          id: "00000000-0000-0000-0000-000000000001",
          name: "Club de Golf",
          alias: null,
          company: null,
          email: null,
          phone: null,
          source: null,
          status: "lost",
          estimated_value: null,
          score: null,
          lost_reason: "Eligió competencia",
          lost_at: "2026-08-20T10:00:00.000Z",
          created_at: "2026-08-01T10:00:00.000Z",
          assignee: null,
          recoveryState: "pending",
          lastContactedAt: null,
          outreachCount: 0,
          openCount: 0,
          clickCount: 0,
          lastOpenedAt: null,
          lastClickedAt: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quitar de Repesca" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() =>
      expect(archiveRecoveryLead).toHaveBeenCalledWith({
        leadId: "00000000-0000-0000-0000-000000000001",
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });
});
