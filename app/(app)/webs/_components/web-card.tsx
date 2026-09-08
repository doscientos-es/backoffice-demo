import {
  TriangleAlert as AlertTriangle,
  Clock,
  Globe,
  HardDrive as Server,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { HOSTING_PROVIDER_LABELS } from '@/lib/schemas/web-project'
import { cn, relativeTime } from '@/lib/utils'
import type { ExpiryState } from '@/lib/webs/domain-expiry'
import { domainExpiryDays, domainExpiryState } from '@/lib/webs/domain-expiry'
import { checkSiteStatus } from '@/lib/webs/og'
import type { WebProjectListItem } from '@/lib/webs/types'

import { WebCardExternalLink } from './web-card-external-link'

// ─── Status dot ──────────────────────────────────────────────────────────────

async function SiteStatusDot({ url }: { url: string }) {
  const s = await checkSiteStatus(url)
  const label = s.ok
    ? `Online · ${s.status}${s.latencyMs !== null ? ` · ${s.latencyMs}ms` : ''}`
    : (s.error ?? `Error ${s.status ?? ''}`)
  return (
    <span
      role="img"
      className={cn(
        'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
        s.ok ? 'bg-green-500' : 'bg-destructive',
      )}
      title={label}
      aria-label={label}
    />
  )
}

function ExpiryBadge({ days, state }: { days: number; state: ExpiryState }) {
  if (state === 'expired')
    return (
      <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
        <ShieldAlert className="size-3" />
        Dominio vencido
      </span>
    )
  if (state === 'critical')
    return (
      <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
        <AlertTriangle className="size-3" />
        Vence en {days} día{days !== 1 ? 's' : ''}
      </span>
    )
  if (state === 'warning')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        <Clock className="size-3" />
        Vence en {days} días
      </span>
    )
  return null
}

// ─── card ────────────────────────────────────────────────────────────────────

export function WebCard({ site }: { site: WebProjectListItem }) {
  const hostname = (() => {
    try {
      return new URL(site.url).hostname
    } catch {
      return site.url
    }
  })()

  const days = domainExpiryDays(site.domain_expires_at)
  const expiry = domainExpiryState(days)

  const hostingLabel = site.hosting_provider
    ? (HOSTING_PROVIDER_LABELS[site.hosting_provider as keyof typeof HOSTING_PROVIDER_LABELS] ??
      site.hosting_provider)
    : null

  return (
    <Link
      href={`/webs/${site.id}`}
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card transition-all',
        'hover:shadow-md hover:-translate-y-px',
        expiry === 'warning'
          ? 'border-amber-300/60 dark:border-amber-700/50'
          : expiry === 'critical' || expiry === 'expired'
            ? 'border-destructive/40'
            : 'border-border hover:border-primary/30',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="bg-muted ring-border/60 relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1">
          {/* biome-ignore lint/performance/noImgElement: favicon externo de Google, no compatible con next/image */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
            alt=""
            width={20}
            height={20}
            className="rounded-sm"
          />
          <Suspense
            fallback={
              <span className="border-card bg-muted-foreground/30 absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2" />
            }
          >
            <SiteStatusDot url={site.url} />
          </Suspense>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground group-hover:text-primary truncate text-sm font-semibold transition-colors">
            {site.name}
          </p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-xs">
            <Globe className="size-3 shrink-0 opacity-60" />
            {hostname}
          </p>
        </div>
        <WebCardExternalLink url={site.url} name={site.name} />
      </div>

      {/* Client and linked delivery project */}
      {site.client_name || site.project_name ? (
        <div className="px-4 pb-3">
          {site.client_name ? (
            <p className="text-muted-foreground truncate text-[11px]">
              <span className="text-foreground/70 font-medium">Cliente:</span> {site.client_name}
            </p>
          ) : null}
          {site.project_name ? (
            <p className="text-muted-foreground truncate text-[11px]">
              <span className="text-foreground/70 font-medium">Proyecto:</span> {site.project_name}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Footer */}
      <div className="border-border/60 bg-muted/30 mt-auto flex flex-wrap items-center gap-1.5 rounded-b-xl border-t px-4 py-2.5">
        {days !== null && expiry !== 'ok' && expiry !== null && (
          <ExpiryBadge days={days} state={expiry} />
        )}
        {hostingLabel && (
          <span className="border-border/70 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
            <Server className="size-3 opacity-60" />
            {hostingLabel}
          </span>
        )}
        {site.tech_stack.slice(0, 3).map((t) => (
          <span
            key={t}
            className="border-border/70 text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[10px]"
          >
            {t}
          </span>
        ))}
        {site.tech_stack.length > 3 && (
          <span className="border-border/70 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]">
            +{site.tech_stack.length - 3}
          </span>
        )}
        {site.updated_at && (
          <span
            className="text-muted-foreground/60 ml-auto shrink-0 text-[10px]"
            title={site.updated_at}
          >
            {relativeTime(site.updated_at)}
          </span>
        )}
      </div>
    </Link>
  )
}
