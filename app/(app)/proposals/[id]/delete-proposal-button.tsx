"use client";

import { CircleX, Copy, Ellipsis as MoreHorizontal, Trash as Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sileo } from "sileo";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@doscientos/ui";
import { useUndoableDelete } from "@/lib/hooks/use-undoable-delete";

import {
  deleteProposal,
  duplicateProposal,
  markProposalAsRejected,
  restoreProposal,
} from "../actions";

/** Builds the `{ id }` FormData both delete and restore proposal actions expect. */
function idFormData(proposalId: string): FormData {
  const fd = new FormData();
  fd.append("id", proposalId);
  return fd;
}

/**
 * Groups secondary proposal operations so the header stays focused on the
 * next business action. Deletion remains reversible through the undo toast.
 */
export function ProposalMoreActions({
  proposalId,
  canReject,
}: {
  proposalId: string;
  canReject: boolean;
}) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [duplicating, startDuplicate] = useTransition();
  const [rejecting, startReject] = useTransition();
  const { run: onDelete, pending: deleting } = useUndoableDelete({
    successMessage: "Propuesta eliminada",
    onDelete: () => deleteProposal(idFormData(proposalId)),
    onRestore: () => restoreProposal(idFormData(proposalId)),
    redirectTo: "/proposals",
  });

  const onDuplicate = () => {
    startDuplicate(async () => {
      const res = await duplicateProposal({ id: proposalId });
      if (res.ok) router.push(`/proposals/${res.id}`);
    });
  };

  const onReject = () => {
    startReject(async () => {
      const res = await markProposalAsRejected({ id: proposalId });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      setRejectOpen(false);
      sileo.success({ title: "Propuesta rechazada" });
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={duplicating || rejecting || deleting}
          aria-label="Más acciones de la propuesta"
          title="Más acciones"
        >
          <MoreHorizontal aria-hidden />
        </Button>
        <DropdownMenuContent placement="bottom end" className="w-48">
          <DropdownMenuItem isDisabled={duplicating} onAction={onDuplicate}>
            <Copy aria-hidden />
            {duplicating ? "Duplicando…" : "Duplicar"}
          </DropdownMenuItem>
          {canReject ? (
            <DropdownMenuItem variant="destructive" onAction={() => setRejectOpen(true)}>
              <CircleX aria-hidden />
              Rechazar propuesta
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" isDisabled={deleting} onAction={onDelete}>
            <Trash2 aria-hidden />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuTrigger>
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="¿Rechazar esta propuesta?"
        description="Se registrará como rechazada por el cliente y se guardará la fecha de respuesta. Podrás reabrirla después si fuera necesario."
        confirmLabel={rejecting ? "Rechazando…" : "Rechazar propuesta"}
        destructive
        pending={rejecting}
        onConfirm={onReject}
      />
    </>
  );
}
