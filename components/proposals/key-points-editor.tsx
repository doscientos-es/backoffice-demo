'use client'

import { ChevronDown, ChevronUp, Plus, Trash as Trash2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createEmptyKeyPoint,
  type EditableKeyPoint,
  KEY_POINTS_LIMITS,
} from '@/lib/proposals/key-points'

export type KeyPointsEditorProps = {
  items: EditableKeyPoint[]
  onChange: (items: EditableKeyPoint[]) => void
  /** When true, every input is disabled. Mirrors `LineItemsTable.locked`. */
  locked?: boolean
  titlePlaceholder?: string
  descriptionPlaceholder?: string
  addLabel?: string
  ariaLabel?: string
}

/**
 * Reusable ordered-list editor for proposal narrative blocks (problems and
 * solutions). Owns add/remove/reorder; consumers only deal with the array
 * via `onChange`. Pairs with the autosave hook used by `ProposalEditor`.
 */
export function KeyPointsEditor({
  items,
  onChange,
  locked = false,
  titlePlaceholder = 'Título',
  descriptionPlaceholder = 'Descripción (opcional)',
  addLabel = 'Añadir',
  ariaLabel,
}: KeyPointsEditorProps) {
  const max = KEY_POINTS_LIMITS.maxCount

  const update = (i: number, patch: Partial<EditableKeyPoint>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  const add = () => {
    if (items.length >= max) return
    onChange([...items, createEmptyKeyPoint()])
  }

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const copy = items.slice()
    const a = copy[i]
    const b = copy[j]
    if (!a || !b) return
    copy[i] = b
    copy[j] = a
    onChange(copy)
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
          Aún no hay puntos. Pulsa “{addLabel}” para añadir el primero.
        </p>
      ) : (
        <ol aria-label={ariaLabel} className="flex flex-col gap-2">
          {items.map((it, i) => (
            <li
              key={it.id}
              className="border-border bg-background flex flex-col gap-1.5 rounded-md border p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground w-6 shrink-0 text-center text-[11px] font-semibold tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Input
                  value={it.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  disabled={locked}
                  placeholder={titlePlaceholder}
                  maxLength={KEY_POINTS_LIMITS.maxTitleLength}
                  aria-label={`${titlePlaceholder} ${i + 1}`}
                  className="h-8 text-sm font-medium"
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={locked || i === 0}
                    aria-label={`Subir punto ${i + 1}`}
                    className="text-muted-foreground hover:bg-accent inline-flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronUp className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={locked || i === items.length - 1}
                    aria-label={`Bajar punto ${i + 1}`}
                    className="text-muted-foreground hover:bg-accent inline-flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronDown className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={locked}
                    aria-label={`Eliminar punto ${i + 1}`}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <Textarea
                value={it.description}
                onChange={(e) => update(i, { description: e.target.value })}
                disabled={locked}
                placeholder={descriptionPlaceholder}
                maxLength={KEY_POINTS_LIMITS.maxDescriptionLength}
                rows={2}
                aria-label={`${descriptionPlaceholder} ${i + 1}`}
                className="ml-7 resize-y text-sm"
              />
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={add}
        disabled={locked || items.length >= max}
        className="text-primary inline-flex w-fit items-center gap-1.5 text-xs font-medium hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden /> {addLabel}
      </button>
      {items.length >= max ? (
        <p className="text-muted-foreground text-[11px]">Máximo {max} puntos por bloque.</p>
      ) : null}
    </div>
  )
}
