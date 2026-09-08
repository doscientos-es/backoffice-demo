'use client'

import { ChevronRight, Mail, Phone } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { useOptimisticRemoval } from '@/lib/hooks/use-optimistic-removal'
import { cn } from '@/lib/utils'

import { deleteClient } from './actions'
import { ClientQuickView, type QuickClient } from './client-quick-view'

export function ClientsList({ canEdit = false, ...props }: ListPageProps & { canEdit?: boolean }) {
  const [selectedClient, setSelectedClient] = useState<QuickClient | null>(null)
  const { items: rows, remove } = useOptimisticRemoval(props.rows)

  const handleDelete = (id: string) => {
    setSelectedClient(null)
    remove(id, () => deleteClient({ id }), { errorMessage: 'No se pudo eliminar el cliente' })
  }

  return (
    <>
      <ListPage
        {...props}
        rows={rows}
        mobileRow={(row) => (
          <ClientMobileCard
            key={row.id}
            client={row.data as QuickClient}
            onOpenAction={() => setSelectedClient(row.data as QuickClient)}
          />
        )}
        onRowClick={(row) => setSelectedClient(row.data as QuickClient)}
      />
      <ClientQuickView
        client={selectedClient}
        canEdit={canEdit}
        onDeleteAction={handleDelete}
        onCloseAction={() => setSelectedClient(null)}
      />
    </>
  )
}

function ClientMobileCard({
  client,
  onOpenAction,
}: {
  client: QuickClient
  onOpenAction: () => void
}) {
  const displayName = client.label?.trim() || client.name
  const hasContact = client.email || client.phone

  return (
    <article className="border-border bg-card active:bg-muted/50 overflow-hidden rounded-xl border shadow-sm transition-colors">
      <button
        type="button"
        onClick={onOpenAction}
        className="focus-visible:ring-ring/50 flex min-h-18 w-full items-center gap-3 px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
        aria-label={`Abrir ficha rápida de ${displayName}`}
      >
        <EntityAvatar name={displayName} logoUrl={client.logo_url} size="md" className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-semibold">
            {displayName}
          </span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {client.nif || 'Sin NIF / CIF'}
          </span>
        </span>
        <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
      </button>
      {hasContact ? (
        <div className="border-border/70 divide-border/70 grid grid-cols-2 divide-x border-t">
          <ContactAction
            href={client.phone ? `tel:${client.phone}` : undefined}
            icon={<Phone className="size-4" />}
          >
            {client.phone || 'Sin teléfono'}
          </ContactAction>
          <ContactAction
            href={client.email ? `mailto:${client.email}` : undefined}
            icon={<Mail className="size-4" />}
          >
            {client.email || 'Sin email'}
          </ContactAction>
        </div>
      ) : null}
    </article>
  )
}

function ContactAction({
  href,
  icon,
  children,
}: {
  href?: string
  icon: ReactNode
  children: ReactNode
}) {
  const className = cn(
    'flex min-h-11 min-w-0 items-center gap-2 px-3 text-xs transition-colors',
    href ? 'text-primary hover:bg-primary/5' : 'text-muted-foreground/60',
  )
  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </>
  )

  return href ? (
    <a className={className} href={href}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  )
}
