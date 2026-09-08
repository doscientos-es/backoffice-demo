'use client'

import { ArrowRight, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { OPEN_SHORTCUTS_DIALOG_EVENT } from '@/components/layout/shortcuts-dialog'
import { CREATE_SHORTCUTS, findShortcut, NAV_SHORTCUTS } from '@/lib/navigation/shortcuts'

type Prefix = 'g' | 'c'

const RESET_MS = 1500

/**
 * Manejador global de atajos de teclado (chord secuencial).
 * `g` + tecla navega; `c` + tecla crea. Único punto de control para
 * evitar colisiones entre ambos prefijos.
 */
export function KeyboardShortcuts() {
  const router = useRouter()
  const prefixRef = useRef<Prefix | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [armed, setArmed] = useState<Prefix | null>(null)

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      prefixRef.current = null
      setArmed(null)
    }

    const arm = (p: Prefix) => {
      prefixRef.current = p
      // flushSync fuerza el re-render inmediato para que el toast aparezca
      // al instante. Sin él, React 18 hace batching y retrasa el indicador visual.
      flushSync(() => setArmed(p))
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        prefixRef.current = null
        setArmed(null)
      }, RESET_MS)
    }

    const onKey = (e: KeyboardEvent) => {
      // Respeta combinaciones del SO/navegador (Ctrl+C, Cmd+K, Alt+←, …).
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return
      }
      // No secuestrar teclas mientras un diálogo/command palette está abierto.
      if (document.querySelector('[data-slot="dialog-content"]')) return

      // `?` abre el panel de referencia de atajos.
      if (e.key === '?') {
        e.preventDefault()
        window.dispatchEvent(new Event(OPEN_SHORTCUTS_DIALOG_EVENT))
        clear()
        return
      }

      const key = e.key.toLowerCase()
      const active = prefixRef.current

      if (!active) {
        if (key === 'g' || key === 'c') {
          e.preventDefault()
          arm(key)
        }
        return
      }

      const list = active === 'g' ? NAV_SHORTCUTS : CREATE_SHORTCUTS
      const match = findShortcut(list, key)
      if (match) {
        e.preventDefault()
        router.push(match.href)
      }
      clear()
    }

    // Firefox/Zen Browser activa su "Quick Find" en keypress, no en keydown.
    // preventDefault() en keydown no lo suprime, así que hay que bloquearlo aquí.
    const onKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      )
        return
      if (document.querySelector('[data-slot="dialog-content"]')) return
      const key = e.key.toLowerCase()
      if (key === 'g' || key === 'c' || e.key === '?' || prefixRef.current !== null) {
        e.preventDefault()
      }
    }

    // Capture phase: interceptamos antes de que Zen/Firefox dispare su
    // "find as you type", que de otro modo abre la barra de búsqueda con `g`.
    document.addEventListener('keydown', onKey, { capture: true })
    document.addEventListener('keypress', onKeyPress, { capture: true })
    return () => {
      document.removeEventListener('keydown', onKey, { capture: true })
      document.removeEventListener('keypress', onKeyPress, { capture: true })
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router])

  if (!armed) return null

  const Icon = armed === 'g' ? ArrowRight : Plus
  const text = armed === 'g' ? 'Ir a…' : 'Crear…'

  return (
    <output
      aria-live="polite"
      className="border-border bg-card text-muted-foreground pointer-events-none fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs shadow-md"
    >
      <Icon className="text-primary h-3.5 w-3.5" />
      <kbd className="bg-secondary text-foreground rounded px-1 font-mono uppercase">{armed}</kbd>
      <span>{text}</span>
    </output>
  )
}
