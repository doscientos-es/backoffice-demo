import { Globe, Plus, ShieldAlert } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { requireUser } from '@/lib/auth'
import { domainExpiryDays, domainExpiryState } from '@/lib/webs/domain-expiry'
import { listWebProjects } from '@/lib/webs/queries'
import type { WebProjectListItem } from '@/lib/webs/types'

import { WebCard } from './_components/web-card'
import { WebFilters } from './_components/web-filters'

export const metadata: Metadata = { title: 'Webs · doscientos' }
export const dynamic = 'force-dynamic'

// ─── Alert bar (no event handlers → safe in Server Component) ───────────────

function ExpiryAlertBar({ sites }: { sites: WebProjectListItem[] }) {
  const urgent = sites.filter((s) => {
    const state = domainExpiryState(domainExpiryDays(s.domain_expires_at))
    return state === 'expired' || state === 'critical'
  })
  if (urgent.length === 0) return null
  return (
    <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm">
      <ShieldAlert className="size-4 shrink-0" />
      <span>
        {urgent.length === 1
          ? `El dominio de "${urgent[0]?.name}" requiere atención inmediata.`
          : `${urgent.length} dominios requieren atención inmediata.`}
      </span>
    </div>
  )
}

function Section({ title, sites }: { title: string; sites: WebProjectListItem[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          {title}
        </p>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
          {sites.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((s) => (
          <WebCard key={s.id} site={s} />
        ))}
      </div>
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<{ q?: string; type?: string }>
}

export default async function WebsPage({ searchParams }: PageProps) {
  await requireUser()
  const [sites, { q = '', type = 'all' }] = await Promise.all([listWebProjects(), searchParams])

  const query = q.trim().toLowerCase()
  const filtered = sites.filter((s) => {
    const matchesType = type === 'own' ? s.is_own : type === 'clients' ? !s.is_own : true
    const matchesQuery =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.url.toLowerCase().includes(query) ||
      (s.client_name ?? '').toLowerCase().includes(query) ||
      s.tech_stack.some((t) => t.toLowerCase().includes(query))
    return matchesType && matchesQuery
  })

  const own = filtered.filter((s) => s.is_own)
  const clients = filtered.filter((s) => !s.is_own)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Webs"
        description="Proyectos web propios y de clientes — hosting, dominios y metadatos."
        actions={
          <Button asChild size="sm">
            <Link href="/webs/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva web
            </Link>
          </Button>
        }
      />

      {/* WebFilters uses useSearchParams → needs Suspense */}
      <Suspense
        fallback={<div className="bg-muted h-8 w-full max-w-xs animate-pulse rounded-md" />}
      >
        <WebFilters q={q} type={type} total={sites.length} />
      </Suspense>

      <ExpiryAlertBar sites={sites} />

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <Globe className="text-muted-foreground/40 size-8" />
          </EmptyHeader>
          <EmptyHeader>
            <EmptyTitle>
              {sites.length === 0 ? 'Aún no hay webs registradas.' : 'Sin coincidencias.'}
            </EmptyTitle>
          </EmptyHeader>
          {sites.length === 0 && (
            <EmptyContent>
              <Button asChild size="sm">
                <Link href="/webs/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Añadir primera web
                </Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {own.length > 0 && <Section title="Webs propias" sites={own} />}
          {clients.length > 0 && <Section title="Webs de clientes" sites={clients} />}
        </div>
      )}
    </div>
  )
}
