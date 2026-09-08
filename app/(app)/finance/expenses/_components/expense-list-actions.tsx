'use client'

import { Copy, Pencil, Trash as Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ExpenseListItem, VendorSuggestion } from '@/lib/finance/types'

import { ExpenseEditDialog } from '../[id]/expense-edit-dialog'
import { removeExpense } from '../actions'

interface Props {
  expense: ExpenseListItem
  projects: Array<{ id: string; name: string; clientName?: string | null }>
  teamMembers: Array<{ id: string; name: string }>
  /** Previously used vendors to power the vendor/NIF autocomplete on edit. */
  vendorSuggestions: VendorSuggestion[]
  /** Only owner/admin can soft-delete from the list. */
  canDelete: boolean
}

export function ExpenseListActions({
  expense,
  projects,
  teamMembers,
  vendorSuggestions,
  canDelete,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const res = await removeExpense({ id: expense.id })
      if (res.ok) {
        setConfirmOpen(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation to the parent row; contains own interactive controls
    <div
      className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setEditOpen(true)}
        aria-label="Editar gasto"
      >
        <Pencil className="size-3.5" />
        <span className="sr-only sm:not-sr-only sm:ml-1">Editar</span>
      </Button>

      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
        <Link href={`/finance/expenses/new?from=${expense.id}`} aria-label="Duplicar gasto">
          <Copy className="size-3.5" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Duplicar</span>
        </Link>
      </Button>

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 px-2 text-xs"
          onClick={() => setConfirmOpen(true)}
          aria-label="Eliminar gasto"
        >
          <Trash2 className="size-3.5" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Eliminar</span>
        </Button>
      ) : null}

      <ExpenseEditDialog
        expense={expense}
        projects={projects}
        teamMembers={teamMembers}
        vendorSuggestions={vendorSuggestions}
        open={editOpen}
        onOpenChange={setEditOpen}
        hideTrigger
      />

      {canDelete ? (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar gasto</DialogTitle>
              <DialogDescription>
                Se eliminará «{expense.vendor}» del listado y dejará de contar en finanzas.
              </DialogDescription>
            </DialogHeader>
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
                {isPending ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
