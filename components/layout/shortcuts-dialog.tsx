'use client'

import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd, KbdGroup } from '@doscientos/ui'
import { CREATE_SHORTCUTS, NAV_SHORTCUTS } from '@/lib/navigation/shortcuts'

/** Evento global para abrir el diálogo desde un botón u otro componente. */
export const OPEN_SHORTCUTS_DIALOG_EVENT = 'open-shortcuts-dialog'

type Row = { keys: string[]; label: string }

const GLOBAL_ROWS: Row[] = [
  { keys: ['⌘/Ctrl', 'K'], label: 'Buscar y ejecutar acciones' },
  { keys: ['?'], label: 'Mostrar este panel de atajos' },
]

/**
 * Diálogo de referencia de atajos de teclado. Se abre con `?` o mediante el
 * evento `OPEN_SHORTCUTS_DIALOG_EVENT`. Lee los atajos de la fuente central
 * (`lib/navigation/shortcuts`) para no duplicar definiciones.
 */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // El prefijo `?` se intercepta de forma central en KeyboardShortcuts
    // (captura) y nos avisa por evento, evitando que Zen abra su buscador.
    const onOpen = () => setOpen((v) => !v)
    window.addEventListener(OPEN_SHORTCUTS_DIALOG_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_SHORTCUTS_DIALOG_EVENT, onOpen)
  }, [])

  const navRows: Row[] = NAV_SHORTCUTS.map((s) => ({
    keys: ['G', s.key.toUpperCase()],
    label: s.label,
  }))
  const createRows: Row[] = CREATE_SHORTCUTS.map((s) => ({
    keys: ['C', s.key.toUpperCase()],
    label: s.label,
  }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            Pulsa los prefijos en secuencia, p. ej. <Kbd>G</Kbd> y luego <Kbd>L</Kbd>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="General" rows={GLOBAL_ROWS} />
          <Section title="Crear · C +" rows={createRows} />
          <Section title="Ir a · G +" rows={navRows} className="sm:col-span-2" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, rows, className }: { title: string; rows: Row[]; className?: string }) {
  return (
    <section className={className}>
      <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{r.label}</span>
            <KbdGroup>
              {r.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </KbdGroup>
          </li>
        ))}
      </ul>
    </section>
  )
}
