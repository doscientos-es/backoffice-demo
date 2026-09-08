"use client";

import { Archive, Ban, Mail, Undo2 as RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sileo } from "sileo";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { publicEnv } from "@/lib/env";
import { leadDisplayName } from "@/lib/leads/utils";
import { getRecoveryTemplate } from "@/lib/recovery/templates";
import type { RecoveryLead } from "@/lib/recovery/types";
import { buildBookingUrl } from "@/lib/recovery/utils";

import { EmailComposer } from "../[id]/email-composer";
import { archiveRecoveryLead, updateLeadStatus } from "../actions";
import { CloseReasonDialog } from "../close-reason-dialog";
import { ReopenConfirmDialog } from "../reopen-confirm-dialog";

/**
 * Per-row recovery actions for a lost lead:
 *  - "Enviar email": opens the shared `EmailComposer` pre-filled with the
 *    reason-aware template (`getRecoveryTemplate`).
 *  - "Reabrir": confirms and moves the lead back to `in_conversation` so it
 *    re-enters the active sales pipeline.
 *  - "Quitar de Repesca": archives a lead that is not worth another attempt.
 */
export function RecoveryActions({ lead, aiEnabled }: { lead: RecoveryLead; aiEnabled?: boolean }) {
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);
  const [pendingReopen, setPendingReopen] = useState(false);
  const [pendingNotInterested, setPendingNotInterested] = useState(false);
  const [pendingArchive, setPendingArchive] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayName = leadDisplayName(lead);
  const bookingUrl = buildBookingUrl(publicEnv.NEXT_PUBLIC_CAL_LINK, {
    id: lead.id,
    name: displayName,
    email: lead.email,
  });
  const template = getRecoveryTemplate(lead.lost_reason, { bookingUrl });

  function handleEmailSuccess() {
    router.refresh();
    setTimeout(() => setEmailOpen(false), 400);
  }

  function confirmReopen() {
    setPendingReopen(false);
    startTransition(async () => {
      const res = await updateLeadStatus({ leadId: lead.id, status: "in_conversation" });
      if (res && !res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      sileo.success({ title: `${displayName} vuelve al pipeline` });
      router.refresh();
    });
  }

  function confirmNotInterested(reason: string) {
    setPendingNotInterested(false);
    startTransition(async () => {
      const res = await updateLeadStatus({
        leadId: lead.id,
        status: "not_interested",
        lostReason: reason,
      });
      if (res && !res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      sileo.success({ title: `${displayName} marcado como no interesado` });
      router.refresh();
    });
  }

  function confirmArchive() {
    setPendingArchive(false);
    startTransition(async () => {
      const res = await archiveRecoveryLead({ leadId: lead.id });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      sileo.success({ title: `${displayName} quitado de Repesca` });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!lead.email}>
            <Mail className="size-3.5" />
            Enviar email
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Repescar a {displayName}</DialogTitle>
            {lead.email ? <DialogDescription>{lead.email}</DialogDescription> : null}
          </DialogHeader>
          <EmailComposer
            leadId={lead.id}
            defaultTo={lead.email ?? ""}
            defaultSubject={template.subject}
            defaultBody={template.body}
            disabled={!lead.email}
            disabledReason="Este lead no tiene email registrado."
            aiEnabled={aiEnabled}
            onSuccess={handleEmailSuccess}
          />
        </DialogContent>
      </Dialog>

      {lead.status !== "not_interested" ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1.5"
          disabled={isPending}
          onClick={() => setPendingNotInterested(true)}
        >
          <Ban className="size-3.5" />
          No interesa
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground gap-1.5"
        disabled={isPending}
        onClick={() => setPendingArchive(true)}
      >
        <Archive className="size-3.5" />
        Quitar de Repesca
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => setPendingReopen(true)}
      >
        <RotateCcw className="size-3.5" />
        Reabrir
      </Button>

      <ReopenConfirmDialog
        lead={pendingReopen ? { id: lead.id, name: displayName } : null}
        title="Reabrir lead"
        description={(name) => (
          <>
            Se moverá a <strong>{name}</strong> a <strong>En conversación</strong> para retomar el
            contacto. Podrás continuar el ciclo de ventas desde su ficha.
          </>
        )}
        confirmLabel="Sí, reabrir"
        onCancel={() => setPendingReopen(false)}
        onConfirm={confirmReopen}
      />

      <CloseReasonDialog
        lead={pendingNotInterested ? { id: lead.id, name: displayName } : null}
        variant="not_interested"
        onCancel={() => setPendingNotInterested(false)}
        onConfirm={confirmNotInterested}
      />

      <ConfirmDialog
        open={pendingArchive}
        onOpenChange={setPendingArchive}
        title="¿Quitar de Repesca?"
        description={
          <>
            <strong>{displayName}</strong> se archivará y dejará de aparecer en esta lista. Su
            historial y el motivo por el que se perdió se conservarán.
          </>
        }
        confirmLabel="Sí, quitar"
        pending={isPending}
        onConfirm={confirmArchive}
      />
    </div>
  );
}
