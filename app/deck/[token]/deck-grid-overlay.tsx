'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { DeckSlide } from './deck-slides'

export function DeckGridOverlay({
  slides,
  current,
  onSelect,
  onClose,
}: {
  slides: DeckSlide[]
  current: number
  onSelect: (index: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
    return () => {
      if (el?.open) el.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="deck-grid-overlay no-print"
      aria-label="Vista general de diapositivas"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold tracking-[0.25em] text-white/40 uppercase sm:text-xs sm:tracking-[0.3em]">
            Vista general
          </p>
          <h2 className="truncate text-lg font-bold text-white sm:text-2xl">
            {slides.length} diapositivas
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="deck-btn flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          <X className="size-4" />
          <span className="deck-btn-label">Cerrar</span>
        </button>
      </div>

      <div className="deck-grid">
        {slides.map((slide, i) => (
          <button
            type="button"
            key={slide.key}
            onClick={() => onSelect(i)}
            data-accent={slide.accent}
            data-active={i === current}
            className="deck-grid-card"
            aria-label={`Ir a ${slide.label}`}
          >
            <span className="deck-grid-card-index">{String(i + 1).padStart(2, '0')}</span>
            <span>{slide.label}</span>
          </button>
        ))}
      </div>
    </dialog>
  )
}
