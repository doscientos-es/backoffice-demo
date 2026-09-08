import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { requireUser } from '@/lib/auth'
import { listClients } from '@/lib/clients/queries'
import { CLIENT_LIST_PAGE_SIZE, CLIENT_SORT_COLUMNS } from '@/lib/clients/types'
import { clientDisplayName } from '@/lib/clients/utils'
import { parsePage, parseSortParam, parseStringParam } from '@/lib/utils/search-params'

import { ClientRowActions } from './client-row-actions'
import { ClientsList } from './clients-list'

export const metadata: Metadata = { title: 'Clientes · doscientos' }
export const dynamic = 'force-dynamic'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const canEdit = user.role !== 'viewer'
  const sp = await searchParams
  const q = parseStringParam(sp, 'q')
  const page = parsePage(sp)
  const { sort, dir } = parseSortParam(sp, CLIENT_SORT_COLUMNS, 'created_at', 'desc')

  const { data, count } = await listClients({ q, page, sort, dir })

  return (
    <ClientsList
      canEdit={canEdit}
      title="Clientes"
      empty={q ? 'Sin coincidencias para tu búsqueda.' : 'Aún no hay clientes.'}
      error={undefined}
      searchKey="q"
      searchPlaceholder="Buscar por nombre, NIF o email…"
      pagination={{ page, pageSize: CLIENT_LIST_PAGE_SIZE, total: count }}
      addHref="/clients/new"
      addLabel="Nuevo cliente"
      actions={
        <Button asChild size="sm" className="min-h-11 w-full sm:w-auto">
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Link>
        </Button>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Crear primer cliente
          </Link>
        </Button>
      }
      headers={[
        { label: 'Nombre', sortKey: 'name' },
        { label: 'NIF', sortKey: 'nif' },
        { label: 'Email', sortKey: 'email' },
      ]}
      exportFilename="clientes"
      rows={
        data?.map((c) => {
          const displayName = clientDisplayName(c)
          return {
            id: c.id as string,
            href: `/clients/${c.id}`,
            data: {
              id: c.id,
              name: c.name,
              label: c.label,
              email: c.email,
              phone: c.phone,
              nif: c.nif,
              contact_person: c.contact_person,
              updated_at: c.updated_at,
              logo_url: c.logo_url,
              billing_address_street: c.billing_address_street,
              billing_address_zip: c.billing_address_zip,
              billing_address_city: c.billing_address_city,
              billing_address_province: c.billing_address_province,
              billing_address_country: c.billing_address_country,
              notes: c.notes,
              version: c.version,
            },
            cells: [
              <div key="name" className="flex items-center gap-2">
                <EntityAvatar name={displayName} logoUrl={c.logo_url} size="sm" />
                <span className="truncate font-medium">{displayName}</span>
              </div>,
              (c.nif as string | null) ?? '—',
              (c.email as string | null) ?? '—',
            ],
            csvValues: [displayName, c.nif ?? '', c.email ?? ''],
            rowActions: (
              <ClientRowActions
                client={{
                  id: c.id,
                  version: c.version,
                  name: c.name,
                  label: c.label,
                  nif: c.nif,
                  email: c.email,
                  phone: c.phone,
                  contact_person: c.contact_person,
                  billing_address_street: c.billing_address_street,
                  billing_address_zip: c.billing_address_zip,
                  billing_address_city: c.billing_address_city,
                  billing_address_province: c.billing_address_province,
                  billing_address_country: c.billing_address_country,
                  notes: c.notes,
                  logo_url: c.logo_url,
                }}
              />
            ),
          }
        }) ?? []
      }
    />
  )
}
