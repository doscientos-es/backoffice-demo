"use client";

import { Trash as Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";

import { deleteLeadInteraction } from "../actions";

export function DeleteLeadInteractionButton({
  leadId,
  interactionId,
  label,
}: {
  leadId: string;
  interactionId: string;
  label: "llamada" | "nota";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const onConfirm = async () => {
    setPending(true);
    const result = await deleteLeadInteraction({ leadId, interactionId });
    setPending(false);
    if (!result.ok) return sileo.error({ title: result.error });
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <IconButton
        type="button"
        variant="ghost"
        size="icon-xs"
        label={`Eliminar ${label}`}
        title={`Eliminar ${label}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3" />
      </IconButton>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Eliminar esta ${label}?`}
        description="Esta acción eliminará la entrada del historial y no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        pending={pending}
        onConfirm={() => void onConfirm()}
      />
    </>
  );
}
