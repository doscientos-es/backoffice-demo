'use client'

import { Pencil, Trash as Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useUndoableDelete } from '@/lib/hooks/use-undoable-delete'

import { ClientEditDialog } from './[id]/client-edit-dialog'
import { deleteClient, restoreClient } from './actions'

type Client = {
  id: string
  name: string
  label: string | null
  nif: string | null
  email: string | null
  phone: string | null
  contact_person: string | null
  billing_address_street: string | null
  billing_address_zip: string | null
  billing_address_city: string | null
  billing_address_province: string | null
  billing_address_country: string | null
  notes: string | null
  logo_url: string | null
  version: number
}

export function ClientRowActions({ client }: { client: Client }) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { run: handleDelete, pending } = useUndoableDelete({
    successMessage: 'Cliente eliminado',
    onDelete: () => deleteClient({ id: client.id }),
    onRestore: () => restoreClient({ id: client.id }),
  })

  return (
    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <ClientEditDialog
        client={client}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Editar cliente">
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        aria-label="Eliminar cliente"
      >
        <Trash2 className="size-3.5" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Eliminar cliente?"
        description={`"${client.name}" se eliminará. Podrás deshacerlo justo después.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          setConfirmOpen(false)
          handleDelete()
        }}
      />
    </div>
  )
}
