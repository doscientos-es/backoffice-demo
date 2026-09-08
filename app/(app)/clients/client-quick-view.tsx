'use client'

import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@doscientos/ui'
import {
  ArrowUpRight,
  Building2,
  FileText,
  Mail,
  MapPin,
  Phone,
  Trash as Trash2,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { relativeTime } from '@/lib/utils'

import { ClientEditDialog } from './[id]/client-edit-dialog'

export type QuickClient = {
  id: string
  name: string
  label: string | null
  logo_url: string | null
  email: string | null
  phone: string | null
  nif: string | null
  contact_person: string | null
  billing_address_street: string | null
  billing_address_zip: string | null
  billing_address_city: string | null
  billing_address_province: string | null
  billing_address_country: string | null
  notes: string | null
  updated_at: string
  version: number
}

export function ClientQuickView({
  client,
  canEdit = false,
  onDeleteAction,
  onCloseAction,
}: {
  client: QuickClient | null
  canEdit?: boolean
  onDeleteAction?: (id: string) => void
  onCloseAction: () => void
}) {
  return (
    <DrawerContent
      isOpen={!!client}
      onOpenChange={(open) => !open && onCloseAction()}
      side="bottom"
      className="h-[78svh] max-h-[85svh] rounded-t-2xl sm:h-full sm:max-h-none sm:rounded-none sm:data-[side=bottom]:inset-y-0 sm:data-[side=bottom]:right-0 sm:data-[side=bottom]:left-auto sm:data-[side=bottom]:w-3/4 sm:data-[side=bottom]:max-w-sm sm:data-[side=bottom]:border-t-0 sm:data-[side=bottom]:border-l"
      showCloseButton={false}
    >
      {client ? (
        <ErrorBoundary>
          <Body client={client} canEdit={canEdit} onDeleteAction={onDeleteAction} />
        </ErrorBoundary>
      ) : null}
    </DrawerContent>
  )
}

function Body({
  client,
  canEdit,
  onDeleteAction,
}: {
  client: QuickClient
  canEdit: boolean
  onDeleteAction?: (id: string) => void
}) {
  const displayName = client.label?.trim() || client.name

  const addressParts = [
    client.billing_address_street,
    [client.billing_address_zip, client.billing_address_city].filter(Boolean).join(' '),
    client.billing_address_province,
  ].filter(Boolean)
  const hasAddress = addressParts.length > 0

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto]">
      <DrawerHeader className="border-border flex flex-row items-start justify-between gap-2 border-b">
        <div className="flex min-w-0 items-start gap-3">
          <EntityAvatar
            name={displayName}
            logoUrl={client.logo_url}
            size="md"
            className="mt-0.5 shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <DrawerTitle className="truncate">{displayName}</DrawerTitle>
            <DrawerDescription className="flex flex-wrap items-center gap-1.5">
              {client.nif && <Badge variant="neutral">{client.nif}</Badge>}
              <span className="text-[11px] tabular-nums">{relativeTime(client.updated_at)}</span>
            </DrawerDescription>
          </div>
        </div>
        <DrawerClose variant="ghost" size="icon-sm" aria-label="Cerrar">
          <X className="size-4" />
        </DrawerClose>
      </DrawerHeader>

      <div className="scroll-fade no-scrollbar flex flex-col gap-5 overflow-y-auto p-4">
        {/* Contact */}
        <section className="flex flex-col gap-2 text-xs">
          <Heading>Contacto</Heading>
          {client.contact_person && (
            <Row icon={<User className="size-3.5" />}>{client.contact_person}</Row>
          )}
          {client.email ? (
            <Row icon={<Mail className="size-3.5" />} href={`mailto:${client.email}`}>
              {client.email}
            </Row>
          ) : (
            <Row icon={<Mail className="size-3.5" />}>
              <span className="text-muted-foreground/50">Sin email</span>
            </Row>
          )}
          {client.phone ? (
            <Row icon={<Phone className="size-3.5" />} href={`tel:${client.phone}`}>
              {client.phone}
            </Row>
          ) : (
            <Row icon={<Phone className="size-3.5" />}>
              <span className="text-muted-foreground/50">Sin teléfono</span>
            </Row>
          )}
        </section>

        {/* Billing address */}
        {hasAddress && (
          <section className="flex flex-col gap-2 text-xs">
            <Heading>Dirección de facturación</Heading>
            <Row icon={<MapPin className="size-3.5" />}>
              <span className="whitespace-pre-line">{addressParts.join('\n')}</span>
            </Row>
          </section>
        )}

        {/* Fiscal */}
        {client.nif && (
          <section className="flex flex-col gap-2 text-xs">
            <Heading>Fiscal</Heading>
            <Row icon={<Building2 className="size-3.5" />}>{client.nif}</Row>
          </section>
        )}

        {/* Notes */}
        {client.notes && (
          <section className="flex flex-col gap-2 text-xs">
            <Heading>
              <span className="flex items-center gap-1.5">
                <FileText className="size-3" />
                Notas
              </span>
            </Heading>
            <p className="bg-muted/30 text-muted-foreground rounded-md p-2 leading-relaxed whitespace-pre-wrap">
              {client.notes}
            </p>
          </section>
        )}
      </div>

      <footer className="border-border flex flex-wrap items-center gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {canEdit && (
          <>
            {onDeleteAction && (
              <DeleteClientInlineButton
                clientId={client.id}
                clientName={displayName}
                onConfirmAction={onDeleteAction}
              />
            )}
            <ClientEditDialog
              client={client}
              trigger={
                <Button variant="outline" size="sm" className="min-h-11 gap-1.5">
                  Editar
                </Button>
              }
            />
          </>
        )}
        <Button asChild className="min-h-11 flex-1" size="sm" variant="outline">
          <Link href={`/clients/${client.id}`}>
            Ver detalle
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </footer>
    </div>
  )
}

function DeleteClientInlineButton({
  clientId,
  clientName,
  onConfirmAction,
}: {
  clientId: string
  clientName: string
  onConfirmAction: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  function onConfirm() {
    setOpen(false)
    onConfirmAction(clientId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar cliente"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar cliente</DialogTitle>
          <DialogDescription>
            ¿Eliminar <strong>{clientName}</strong>? Podrás restaurarlo desde la base de datos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
      {children}
    </p>
  )
}

function Row({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  const inner = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{children}</span>
    </>
  )
  return href ? (
    <a
      href={href}
      className="hover:text-primary flex min-h-11 items-center gap-2 transition-colors"
    >
      {inner}
    </a>
  ) : (
    <div className="flex min-h-11 items-center gap-2">{inner}</div>
  )
}
