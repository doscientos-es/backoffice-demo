import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  backupInvoiceToDrive,
  consumeUserVerification,
  deliverVerifactuOutbox,
  ensureInvoiceRecipientVerified,
  findInvoiceForEdit,
  patchInvoiceStatus,
  rpc,
  syncInvoiceQrFromLedger,
} = vi.hoisted(() => ({
  backupInvoiceToDrive: vi.fn(),
  consumeUserVerification: vi.fn(),
  deliverVerifactuOutbox: vi.fn(),
  ensureInvoiceRecipientVerified: vi.fn(),
  findInvoiceForEdit: vi.fn(),
  patchInvoiceStatus: vi.fn(),
  rpc: vi.fn(),
  syncInvoiceQrFromLedger: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: async () => ({ id: "user-1", email: "admin@example.test", role: "admin" }),
  requireUser: async () => ({ id: "user-1", email: "admin@example.test", role: "admin" }),
}));
vi.mock("@/lib/google/backup", () => ({ backupInvoiceToDrive }));
vi.mock("@/lib/clients/fiscal-verification", () => ({ ensureInvoiceRecipientVerified }));
vi.mock("@/lib/invoices/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/invoices/queries")>()),
  findInvoiceForEdit,
  patchInvoiceStatus,
}));
vi.mock("@/lib/security/user-verification", () => ({ consumeUserVerification }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({ rpc }) }));
vi.mock("@/lib/verifactu/outbox", () => ({
  assertDurableVerifactuPackage: vi.fn(),
  deliverInvoiceVerifactu: vi.fn(),
  deliverVerifactuOutbox,
  syncInvoiceQrFromLedger,
}));
vi.mock("@/lib/verifactu/config", () => ({
  verifactuSoftwareSnapshotFromEnv: () => ({
    producerName: "Test producer",
    producerNif: "B12345678",
    name: "Test SIF",
    id: "T1",
    version: "1.0.0",
    installationNumber: "00000001",
    onlyVerifactu: true,
    multipleTaxpayers: false,
  }),
}));
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { regularizeVerifactu, revertInvoicePayment, updateInvoiceStatus } from "./actions";

const INVOICE_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  consumeUserVerification.mockReset();
  consumeUserVerification.mockResolvedValue(undefined);
  deliverVerifactuOutbox.mockReset();
  ensureInvoiceRecipientVerified.mockReset();
  ensureInvoiceRecipientVerified.mockResolvedValue(undefined);
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [{ outbox_id: "outbox-1" }], error: null });
  deliverVerifactuOutbox.mockResolvedValue({ processed: true, status: "accepted", csv: "CSV-1" });
  backupInvoiceToDrive.mockReset();
  findInvoiceForEdit.mockResolvedValue({ status: "paid" });
  patchInvoiceStatus.mockReset();
  syncInvoiceQrFromLedger.mockReset();
});

describe("updateInvoiceStatus fiscal flow", () => {
  it("creates an Alta ledger/outbox before attempting immediate delivery", async () => {
    const result = await updateInvoiceStatus({ id: INVOICE_ID, status: "issued" });

    expect(result).toEqual({
      ok: true,
      fiscalDeliveryCsv: "CSV-1",
      fiscalDeliveryStatus: "accepted",
    });
    expect(rpc).toHaveBeenCalledWith("issue_invoice_with_number_and_verifactu_outbox", {
      p_invoice_id: INVOICE_ID,
      p_software: expect.objectContaining({ producerNif: "B12345678" }),
    });
    expect(deliverVerifactuOutbox).toHaveBeenCalledWith(
      "outbox-1",
      expect.stringMatching(/^action:/),
    );
    expect(syncInvoiceQrFromLedger).toHaveBeenCalledWith(INVOICE_ID);
    expect(backupInvoiceToDrive).toHaveBeenCalledWith(INVOICE_ID, "admin@example.test");
    expect(consumeUserVerification).toHaveBeenCalledWith("user-1", {
      intent: "invoice.status.update",
      resource: `invoice:${INVOICE_ID}:status:issued`,
    });
  });

  it("does not interrupt a routine paid status update with step-up verification", async () => {
    const result = await updateInvoiceStatus({ id: INVOICE_ID, status: "paid" });

    expect(result).toEqual({
      ok: true,
      fiscalDeliveryCsv: null,
      fiscalDeliveryStatus: null,
    });
    expect(consumeUserVerification).not.toHaveBeenCalled();
    expect(patchInvoiceStatus).toHaveBeenCalledWith(
      INVOICE_ID,
      expect.objectContaining({ status: "paid" }),
    );
  });

  it("creates a RegistroAnulacion outbox instead of directly cancelling", async () => {
    const result = await updateInvoiceStatus({ id: INVOICE_ID, status: "cancelled" });

    expect(result).toEqual({
      ok: true,
      fiscalDeliveryCsv: "CSV-1",
      fiscalDeliveryStatus: "accepted",
    });
    expect(rpc).toHaveBeenCalledWith("cancel_invoice_with_verifactu_outbox", {
      p_invoice_id: INVOICE_ID,
      p_software: expect.objectContaining({ producerNif: "B12345678" }),
    });
    expect(backupInvoiceToDrive).not.toHaveBeenCalled();
    expect(syncInvoiceQrFromLedger).not.toHaveBeenCalled();
  });

  it("reports a technical delivery failure without undoing the durable issuance", async () => {
    deliverVerifactuOutbox.mockResolvedValue({ processed: true, status: "error", csv: null });

    const result = await updateInvoiceStatus({ id: INVOICE_ID, status: "issued" });

    expect(result).toEqual({ ok: true, fiscalDeliveryCsv: null, fiscalDeliveryStatus: "error" });
    expect(rpc).toHaveBeenCalledWith("issue_invoice_with_number_and_verifactu_outbox", {
      p_invoice_id: INVOICE_ID,
      p_software: expect.objectContaining({ producerNif: "B12345678" }),
    });
    expect(syncInvoiceQrFromLedger).not.toHaveBeenCalled();
  });

  it("reverts a payment without enqueuing a second fiscal record", async () => {
    const result = await revertInvoicePayment({ id: INVOICE_ID });

    expect(result).toEqual({ ok: true });
    expect(patchInvoiceStatus).toHaveBeenCalledWith(
      INVOICE_ID,
      expect.objectContaining({ status: "issued", paid_at: null, payment_method: null }),
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(deliverVerifactuOutbox).not.toHaveBeenCalled();
  });

  it("requires an intent-scoped proof before regularizing a fiscal record", async () => {
    const result = await regularizeVerifactu({ id: INVOICE_ID });

    expect(result).toEqual({ ok: true, csv: "CSV-1", status: "accepted", error: null });
    expect(consumeUserVerification).toHaveBeenCalledWith("user-1", {
      intent: "invoice.verifactu_regularize",
      resource: `invoice:${INVOICE_ID}`,
    });
    expect(ensureInvoiceRecipientVerified).toHaveBeenCalledWith(INVOICE_ID, "user-1");
    expect(rpc).toHaveBeenCalledWith("regularize_verifactu_invoice", {
      p_invoice_id: INVOICE_ID,
      p_software: expect.objectContaining({ producerNif: "B12345678" }),
    });
  });

  it("does not create a regularization when AEAT cannot verify the recipient", async () => {
    ensureInvoiceRecipientVerified.mockRejectedValueOnce(
      new Error("No se ha podido validar el destinatario con AEAT"),
    );

    const result = await regularizeVerifactu({ id: INVOICE_ID });

    expect(result).toEqual({
      ok: false,
      error: "No se ha podido validar el destinatario con AEAT",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(deliverVerifactuOutbox).not.toHaveBeenCalled();
  });
});
