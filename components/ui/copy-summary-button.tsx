'use client'

import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'
import { sileo } from 'sileo'

import { cn } from '@/lib/utils'

interface CopySummaryButtonProps {
  /**
   * Pre-formatted text lines built server-side (no URL — it is appended
   * client-side so the domain always matches the deployment being viewed).
   */
  lines: string[]
  /** App-relative path, e.g. "/clients/abc". Resolved to a full URL on click. */
  urlPath: string
  /** Optional compact label, shown on narrow screens. */
  label?: string
  className?: string
}

/**
 * Ghost icon button that copies a multi-line entity summary + a deep-link
 * to the current deployment's URL. Designed for quick sharing in chat or email.
 *
 * Example output:
 *   👤 Acme Corp (B12345678)
 *   Email: facturacion@acme.com · Tel: +34 600 000 000
 *   Dirección: Calle Mayor 1, 08001 Barcelona
 *   → https://backoffice.example.com/clients/…
 */
export function CopySummaryButton({ lines, urlPath, label, className }: CopySummaryButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}${urlPath}`
    const text = [...lines, `→ ${url}`].join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: label ?? 'Ficha de Doscientos', text, url })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      sileo.success({ title: 'Ficha copiada al portapapeles' })
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      sileo.error({ title: 'No se pudo copiar' })
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copiar ficha"
      title="Copiar ficha al portapapeles"
      className={cn(
        'inline-flex h-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Share2 className="size-3.5" />
      )}
      {label ? <span className="sm:hidden">{label}</span> : null}
    </button>
  )
}
