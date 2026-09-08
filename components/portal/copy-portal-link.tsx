'use client'

import { Check, Copy, ExternalLink, Link as Link2 } from 'lucide-react'
import { useState } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Renders a public portal link (e.g. an invoice payment page) with
 * copy-to-clipboard and open-in-new-tab affordances. Channel-agnostic: the
 * team can grab the URL to share via WhatsApp, SMS, etc. — not just email.
 *
 * The absolute URL is resolved client-side from `window.location.origin`, so
 * it always matches the deployment the user is browsing.
 */
export function CopyPortalLink({
  path,
  label = 'Enlace de pago',
}: {
  path: string
  label?: string
}) {
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
      )}
    >
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
        <Link2 className="size-4" aria-hidden />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-tight font-medium">{label}</span>
        <span className="text-muted-foreground/80 truncate font-mono text-xs">{path}</span>
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
