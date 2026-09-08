'use client'

import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Evento global para abrir el command palette desde cualquier botón. */
export const OPEN_COMMAND_PALETTE_EVENT = 'command-palette:open'

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))
}

/**
 * Botón discoverable que abre el command palette. Dos variantes:
 * - `field`: caja tipo buscador con atajo (para el sidebar).
 * - `icon`: botón de icono compacto (para el header móvil).
 */
export function CommandPaletteTrigger({
  variant = 'field',
  className,
}: {
  variant?: 'field' | 'icon'
  className?: string
}) {
  if (variant === 'icon') {
    return (
      <button
        type="button"
        aria-label="Buscar (⌘K)"
        onClick={openCommandPalette}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          className,
        )}
      >
        <Search className="h-5 w-5" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={cn(
        'group flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground',
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
        ⌘K
      </kbd>
    </button>
  )
}
