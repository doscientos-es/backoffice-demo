'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { sileo } from 'sileo'

import { cn } from '@/lib/utils'

interface CopyButtonProps {
  /** Text that will be written to the clipboard. */
  text: string
  /** Toast message shown on success. */
  successMessage?: string
  /** Accessible label for the button. */
  label?: string
  /** Shows a compact text label next to the icon. */
  showLabel?: boolean
  className?: string
}

/**
 * Small button that copies `text` to the clipboard; icon-only by default.
 * Shows a ✓ tick for 1.5 s after a successful copy.
 */
export function CopyButton({
  text,
  successMessage = 'Copiado al portapapeles',
  label = 'Copiar',
  showLabel = false,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      sileo.success({ title: successMessage })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      sileo.error({ title: 'No se pudo copiar' })
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        showLabel ? 'h-7 gap-1.5 px-2 text-xs font-medium' : 'size-6',
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {showLabel ? <span>{copied ? 'Copiado' : 'Copiar'}</span> : null}
    </button>
  )
}
