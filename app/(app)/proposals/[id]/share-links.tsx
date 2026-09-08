'use client'

import {
  TriangleAlert as AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Presentation,
} from 'lucide-react'
import { useState } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ShareLinkKind = 'portal' | 'deck'

type Meta = {
  label: string
  path: (token: string) => string
  Icon: typeof FileText
}

const META: Record<ShareLinkKind, Meta> = {
  portal: { label: 'Propuesta', path: (t) => `/p/proposal/${t}`, Icon: FileText },
  deck: { label: 'Presentación', path: (t) => `/deck/${t}`, Icon: Presentation },
}

function formatViewedAt(value: string): string {
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Renders the two public share links of a proposal (portal + deck) with
 * copy-to-clipboard and open-in-new-tab affordances. When `isDraft` is true
 * a warning callout is shown so team members don't accidentally share the
 * link before the proposal has been sent (clients would get a 404).
 */
export function ShareLinks({
  token,
  portalViewedAt,
  deckViewedAt,
  isDraft = false,
}: {
  token: string
  portalViewedAt: string | null
  deckViewedAt: string | null
  isDraft?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {isDraft && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Borrador — </strong>
            estos enlaces dan error 404 al cliente. Envía la propuesta para activarlos.
          </span>
        </div>
      )}
      <ShareLinkRow kind="portal" token={token} lastViewedAt={portalViewedAt} isDraft={isDraft} />
      <ShareLinkRow kind="deck" token={token} lastViewedAt={deckViewedAt} isDraft={isDraft} />
    </div>
  )
}

function ShareLinkRow({
  kind,
  token,
  lastViewedAt,
  isDraft = false,
}: {
  kind: ShareLinkKind
  token: string
  lastViewedAt: string | null
  isDraft?: boolean
}) {
  const meta = META[kind]
  const path = meta.path(token)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}${path}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      sileo.success({ title: 'Enlace copiado' })
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      sileo.error({ title: 'No se pudo copiar el enlace' })
    }
  }

  const handleOpen = () => {
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border/60 px-2.5 py-2 transition-colors',
        'hover:border-border hover:bg-muted/40',
        isDraft && 'opacity-60',
      )}
    >
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
        <meta.Icon className="size-4" aria-hidden />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-tight font-medium">{meta.label}</span>
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11px]">
          {lastViewedAt ? (
            <>
              <span
                className="inline-flex size-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <time
                dateTime={lastViewedAt}
                className="text-emerald-700 tabular-nums dark:text-emerald-400"
              >
                Vista el {formatViewedAt(lastViewedAt)}
              </time>
            </>
          ) : (
            <>
              <span
                className="bg-muted-foreground/40 inline-flex size-1.5 shrink-0 rounded-full"
                aria-hidden
              />
              <span>Sin abrir</span>
            </>
          )}
          <span className="text-muted-foreground/60" aria-hidden>
            ·
          </span>
          <span className="text-muted-foreground/80 truncate font-mono">{path}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label="Copiar enlace"
          title="Copiar enlace"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleOpen}
          aria-label="Abrir en pestaña nueva"
          title="Abrir en pestaña nueva"
        >
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
