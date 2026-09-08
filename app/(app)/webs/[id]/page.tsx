import { CheckCircle, Pencil as Edit, ExternalLink, Globe, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { BackLink } from '@/components/layout/back-link'
import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { requireUser } from '@/lib/auth'
import { serverEnv } from '@/lib/env'
import { isFileBrowserConfigured } from '@/lib/filebrowser'
import { HOSTING_PROVIDER_LABELS } from '@/lib/schemas/web-project'
import { checkSiteStatus, fetchOgMetadata } from '@/lib/webs/og'
import { getWebProject } from '@/lib/webs/queries'
import type { OgMetadata, SiteStatus, WebProjectDetail } from '@/lib/webs/types'

import { BackupsCard } from '../_components/backups-card'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const site = await getWebProject(id)
  return { title: site ? `${site.name} · Webs · doscientos` : 'Web · doscientos' }
}

async function StatusCard({ url }: { url: string }) {
  const s: SiteStatus = await checkSiteStatus(url)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Estado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {s.ok ? (
            <CheckCircle className="size-5 text-green-500" />
          ) : (
            <XCircle className="text-destructive size-5" />
          )}
          <span className={`text-sm font-semibold ${s.ok ? 'text-green-600' : 'text-destructive'}`}>
            {s.ok ? `OK · ${s.status}` : (s.error ?? `Error ${s.status ?? ''}`)}
          </span>
          {s.latencyMs !== null && (
            <span className="text-muted-foreground ml-auto text-xs">{s.latencyMs} ms</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

async function OgCard({ site }: { site: WebProjectDetail }) {
  const og: OgMetadata = await fetchOgMetadata(site.url)
  const image = og.image ?? og.twitterImage
  const title = og.title ?? og.twitterTitle ?? site.name

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Open Graph</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {image ? (
          <div className="border-border bg-muted relative aspect-[1200/630] w-full overflow-hidden rounded-lg border">
            <Image src={image} alt="OG Image" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="border-border bg-muted text-muted-foreground flex aspect-[1200/630] w-full items-center justify-center rounded-lg border border-dashed text-xs">
            Sin imagen OG
          </div>
        )}
        <DetailGrid>
          <DetailRow label="Título">{title ?? '—'}</DetailRow>
          <DetailRow label="Descripción">{og.description ?? '—'}</DetailRow>
          <DetailRow label="Site name">{og.siteName ?? '—'}</DetailRow>
          <DetailRow label="Tipo">{og.type ?? '—'}</DetailRow>
          <DetailRow label="Twitter card">{og.twitterCard ?? '—'}</DetailRow>
          <DetailRow label="Canonical">
            {og.canonical ? (
              <a
                href={og.canonical}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary break-all underline-offset-2 hover:underline"
              >
                {og.canonical}
              </a>
            ) : (
              '—'
            )}
          </DetailRow>
        </DetailGrid>
      </CardContent>
    </Card>
  )
}

function OgSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Open Graph</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="aspect-[1200/630] w-full rounded-lg" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  )
}

export default async function WebDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const site = await getWebProject(id)
  if (!site) notFound()

  // Deleting backups is irreversible (no soft-delete), so it's gated to owner/admin.
  const canDeleteBackups = user.role === 'owner' || user.role === 'admin'

  const hostingLabel = site.hosting_provider
    ? (HOSTING_PROVIDER_LABELS[site.hosting_provider as keyof typeof HOSTING_PROVIDER_LABELS] ??
      site.hosting_provider)
    : null

  // Only offer the "force backup" button when there are stored DB credentials
  // and the bridge that actually runs the script is configured.
  const env = serverEnv()
  const canForceBackup =
    site.has_db_password && Boolean(env.BACKUP_RUNNER_URL && env.BACKUP_RUNNER_TOKEN)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={site.name}
        back={<BackLink href="/webs" label="Volver a webs" />}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={site.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-4" />
                Abrir
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href={`/webs/${id}/edit`}>
                <Edit className="mr-1.5 size-4" />
                Editar
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: info */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardContent className="pt-6">
              <DetailGrid>
                <DetailRow label="URL">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary flex items-center gap-1 break-all underline-offset-2 hover:underline"
                  >
                    <Globe className="size-3.5 shrink-0" />
                    {site.url}
                  </a>
                </DetailRow>
                <DetailRow label="Tipo">
                  {site.is_own ? (
                    <Badge variant="info">Web propia</Badge>
                  ) : (
                    <Badge variant="neutral">Web de cliente</Badge>
                  )}
                </DetailRow>
                <DetailRow label="Proyecto">
                  {site.project_id ? (
                    <Link href={`/projects/${site.project_id}`} className="hover:underline">
                      {site.project_name ?? 'Ver proyecto'}
                    </Link>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                {site.project_id ? (
                  <DetailRow label="Portal del proyecto">
                    <Badge variant={site.is_client_visible ? 'success' : 'neutral'}>
                      {site.is_client_visible ? 'Visible' : 'Oculta'}
                    </Badge>
                  </DetailRow>
                ) : null}
                <DetailRow label="Hosting">
                  {site.hosting_url ? (
                    <a
                      href={site.hosting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {hostingLabel ?? '—'}
                    </a>
                  ) : (
                    (hostingLabel ?? '—')
                  )}
                </DetailRow>
                <DetailRow label="Registrador">{site.domain_registrar ?? '—'}</DetailRow>
                <DetailRow label="Vence dominio">
                  {site.domain_expires_at
                    ? new Date(site.domain_expires_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'}
                </DetailRow>
                <DetailRow label="Tech stack">
                  {site.tech_stack.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {site.tech_stack.map((t) => (
                        <Badge key={t} variant="neutral" className="font-mono text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Notas">{site.notes ?? '—'}</DetailRow>
              </DetailGrid>
            </CardContent>
          </Card>
        </div>

        {/* Right: status + OG + backups */}
        <div className="flex min-w-0 flex-col gap-4">
          <Suspense
            fallback={
              <Card>
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            }
          >
            <StatusCard url={site.url} />
          </Suspense>
          <Suspense fallback={<OgSkeleton />}>
            <OgCard site={site} />
          </Suspense>
          {site.backup_slug && isFileBrowserConfigured() && (
            <BackupsCard
              clientSlug={site.backup_slug}
              projectId={site.id}
              canForceBackup={canForceBackup}
              canDelete={canDeleteBackups}
            />
          )}
        </div>
      </div>
    </div>
  )
}
