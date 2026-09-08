'use client'

import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid as Grid3x3,
  CircleHelp as HelpCircle,
  Maximize2,
  Minimize2,
  Printer,
  X,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDeckTapDirection } from './deck-navigation'
import { buildSlides } from './deck-slides'
import { DECK_STYLES } from './deck-styles'
import type { DeckProposal, DeckProposalItem, DeckTeamMember } from './page'

const DeckGridOverlay = dynamic(
  () => import('./deck-grid-overlay').then((m) => ({ default: m.DeckGridOverlay })),
  { ssr: false },
)

const SWIPE_THRESHOLD = 60
const HIDE_DELAY = 3000

const SHORTCUTS = [
  { key: '→ / Space', label: 'Siguiente diapositiva' },
  { key: '←', label: 'Diapositiva anterior' },
  { key: 'Home / End', label: 'Primera / última' },
  { key: '1 – 9', label: 'Saltar a diapositiva N' },
  { key: 'G', label: 'Vista general' },
  { key: 'F', label: 'Pantalla completa' },
  { key: 'P', label: 'Exportar PDF' },
  { key: '?', label: 'Mostrar atajos' },
  { key: 'Esc', label: 'Cerrar panel' },
]

export function DeckViewer({
  proposal,
  items,
  team,
  token,
  isDraft = false,
}: {
  proposal: DeckProposal
  items: DeckProposalItem[]
  team: DeckTeamMember[]
  token: string
  isDraft?: boolean
}) {
  const watermark = proposal.client_email ?? proposal.client_name ?? undefined
  const slides = useMemo(
    () => buildSlides(proposal, items, token, team, watermark),
    [proposal, items, token, team, watermark],
  )
  const total = slides.length
  const router = useRouter()

  const [current, setCurrent] = useState(0)
  const [gridOpen, setGridOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [showOverlay, setShowOverlay] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchMoved = useRef(false)

  // First-time help overlay
  useEffect(() => {
    try {
      if (!localStorage.getItem('deckHelpSeen')) {
        setShowOverlay(true)
        const t = setTimeout(() => {
          setShowOverlay(false)
          localStorage.setItem('deckHelpSeen', '1')
        }, 2500)
        return () => clearTimeout(t)
      }
      setShowTooltip(true)
    } catch {
      /* ignore */
    }
  }, [])

  // Prefetch portal on last slide
  useEffect(() => {
    if (current === total - 1) {
      try {
        router.prefetch(`/p/proposal/${token}` as never)
      } catch {
        /* ignore */
      }
    }
  }, [current, total, token, router])

  // Slide tracking
  useEffect(() => {
    const slide = slides[current]
    if (!slide) return
    const t = setTimeout(() => {
      fetch(`/deck/${token}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideKey: slide.key,
          slideIndex: current,
          totalSlides: total,
          viewerType: 'client',
        }),
      }).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [current, token, total, slides])

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), HIDE_DELAY)
  }, [])
  useEffect(() => {
    resetHideTimer()
    window.addEventListener('mousemove', resetHideTimer)
    window.addEventListener('keydown', resetHideTimer)
    return () => {
      window.removeEventListener('mousemove', resetHideTimer)
      window.removeEventListener('keydown', resetHideTimer)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [resetHideTimer])

  const goTo = useCallback((i: number) => setCurrent(Math.min(total - 1, Math.max(0, i))), [total])
  const prev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setCurrent((i) => Math.min(total - 1, i + 1)), [total])
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showHelp) {
        if (e.key === 'Escape' || e.key === '?') setShowHelp(false)
        return
      }
      if (gridOpen) {
        if (e.key === 'Escape') setGridOpen(false)
        return
      }
      setShowTooltip(false)
      if (e.key >= '1' && e.key <= '9' && !e.metaKey && !e.ctrlKey) {
        goTo(Number.parseInt(e.key, 10) - 1)
        return
      }
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          prev()
          break
        case 'Home':
          e.preventDefault()
          setCurrent(0)
          break
        case 'End':
          e.preventDefault()
          setCurrent(total - 1)
          break
        case 'g':
        case 'G':
          setGridOpen(true)
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'p':
        case 'P':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            window.print()
          }
          break
        case '?':
          setShowHelp(true)
          break
        case 'Escape':
          setShowOverlay(false)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gridOpen, showHelp, next, prev, total, toggleFullscreen, goTo])

  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
    touchMoved.current = false
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    touchMoved.current = Math.abs(dx) > SWIPE_THRESHOLD
    if (touchMoved.current) (dx < 0 ? next : prev)()
    touchStartX.current = null
  }

  function onViewportClick(e: React.MouseEvent<HTMLDivElement>) {
    if (touchMoved.current) {
      touchMoved.current = false
      return
    }
    if (window.matchMedia && !window.matchMedia('(max-width: 768px)').matches) return
    if (window.matchMedia === undefined && window.innerWidth > 768) return

    const target = e.target as HTMLElement
    if (target.closest("a,button,input,textarea,select,[role='button']")) return
    const viewport = e.currentTarget.getBoundingClientRect()
    const direction = getDeckTapDirection(e.clientX, viewport.left, viewport.width)
    ;(direction === 'prev' ? prev : next)()
  }

  const progress = total > 1 ? ((current + 1) / total) * 100 : 100

  return (
    <main className="deck-root">
      {isDraft && (
        <div className="no-print fixed inset-x-0 top-0 z-9999 flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-amber-950">
          <span className="tracking-wider uppercase">Borrador</span>
          <span className="opacity-60">·</span>
          <span className="font-normal opacity-80">Vista previa — solo visible para el equipo</span>
        </div>
      )}
      <style>{DECK_STYLES}</style>
      <div className="deck-progress no-print" aria-hidden>
        <div className="deck-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: tap/click-to-advance is a touch/mouse convenience; full keyboard navigation (arrows, Home/End, digits) is handled by the window keydown listener below */}
      <div
        className="deck-viewport"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onViewportClick}
      >
        <div className="deck-stage" style={{ transform: `translateX(-${current * 100}%)` }}>
          {slides.map((slide, i) => (
            <div key={slide.key} className="deck-slide-wrapper" data-active={i === current}>
              {slide.element}
            </div>
          ))}
        </div>
      </div>
      <div className="deck-dots no-print" aria-hidden>
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className="deck-dot"
            data-active={i === current}
            onClick={() => goTo(i)}
            aria-label={`Ir a diapositiva ${i + 1}`}
          />
        ))}
      </div>
      <div className="deck-controls no-print" data-hidden={!controlsVisible}>
        <button
          type="button"
          onClick={prev}
          disabled={current === 0}
          aria-label="Anterior"
          className="deck-btn"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="deck-counter">
          {current + 1} / {total}
        </span>
        <button
          type="button"
          onClick={next}
          disabled={current === total - 1}
          aria-label="Siguiente"
          className="deck-btn"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="deck-btn-sep" />
        <button
          type="button"
          onClick={() => setGridOpen(true)}
          aria-label="Vista general (G)"
          title="Vista general (G)"
          className="deck-btn"
        >
          <Grid3x3 className="size-4" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Pantalla completa (F)"
          title="Pantalla completa (F)"
          className="deck-btn"
        >
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Exportar PDF (P)"
          title="Exportar PDF (P)"
          className="deck-btn"
        >
          <Printer className="size-4" />
          <span className="deck-btn-label">PDF</span>
        </button>
        <span className="deck-btn-sep" />
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          aria-label="Atajos (?)"
          title="Atajos (?)"
          className="deck-btn"
        >
          <HelpCircle className="size-4" />
        </button>
      </div>

      {/* Arrow tooltip on first slide */}
      {showTooltip && current === 0 && (
        <div className="deck-tooltip no-print" aria-hidden onClick={() => setShowTooltip(false)}>
          Usa las flechas → para navegar
        </div>
      )}

      {/* First-time overlay / shortcuts modal */}
      {(showOverlay || showHelp) && (
        <div
          className="deck-overlay-help no-print"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowOverlay(false)
            setShowHelp(false)
            if (showOverlay) {
              try {
                localStorage.setItem('deckHelpSeen', '1')
              } catch {
                /* ignore */
              }
            }
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: click-boundary guard that stops the backdrop's dismiss handler from firing when interacting with the panel content */}
          <div className="deck-overlay-help-inner" onClick={(e) => e.stopPropagation()}>
            {showHelp ? (
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-semibold text-white/80">Atajos de teclado</p>
                <button
                  type="button"
                  className="deck-btn"
                  onClick={() => setShowHelp(false)}
                  aria-label="Cerrar"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <p className="mb-6 text-xs font-semibold tracking-[0.25em] text-white/40 uppercase">
                Controles
              </p>
            )}
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="deck-shortcut-row">
                <kbd className="deck-kbd">{s.key}</kbd>
                <span className="deck-shortcut-label">{s.label}</span>
              </div>
            ))}
            {!showHelp && <p className="mt-8 text-xs text-white/30">Haz clic para continuar</p>}
          </div>
        </div>
      )}

      {gridOpen && (
        <DeckGridOverlay
          slides={slides}
          current={current}
          onSelect={(i) => {
            goTo(i)
            setGridOpen(false)
          }}
          onClose={() => setGridOpen(false)}
        />
      )}
      <div className="print-all">
        {slides.map((s) => (
          <div key={s.key} className="print-slide">
            {s.element}
          </div>
        ))}
      </div>
    </main>
  )
}
