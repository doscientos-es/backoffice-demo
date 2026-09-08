"use client";

import { Ellipsis as MoreHorizontal, Trash as Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@doscientos/ui";
import { useUndoableDelete } from "@/lib/hooks/use-undoable-delete";

import { deleteClient, restoreClient } from "../actions";

/**
 * Kebab menu hosting destructive actions for a client. Soft-deletes via
 * `deleted_at`, so the row disappears from the UI but stays recoverable. The
 * delete is frictionless (no confirm dialog) and offers a "Deshacer" toast.
 */
export function DeleteClientButton({ clientId }: { clientId: string }) {
  const { run: onDelete, pending } = useUndoableDelete({
    successMessage: "Cliente eliminado",
    onDelete: () => deleteClient({ id: clientId }),
    onRestore: () => restoreClient({ id: clientId }),
    redirectTo: "/clients",
  });

  return (
    <div className="flex items-center gap-2">
      <DropdownMenuTrigger>
        <Button variant="ghost" size="sm" disabled={pending} aria-label="Más acciones">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        <DropdownMenuContent placement="bottom end">
          <DropdownMenuItem className="text-destructive" isDisabled={pending} onAction={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuTrigger>
    </div>
  );
}
