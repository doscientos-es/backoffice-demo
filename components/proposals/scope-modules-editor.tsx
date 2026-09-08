'use client'

import {
  ChevronDown,
  ChevronUp,
  Clipboard as ClipboardPaste,
  Plus,
  Trash as Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createEmptyScopeModule,
  SCOPE_MODULE_DURATION_WEEKS,
  SCOPE_MODULE_LIMITS,
  type ScopeModule,
  scopeModuleDurationLabel,
} from '@/lib/proposals/scope'

type Props = {
  modules: ScopeModule[]
  onChange: (modules: ScopeModule[]) => void
  locked?: boolean
}

type BulletDraft = { id: string; value: string }

function makeDraft(value: string): BulletDraft {
  return { id: crypto.randomUUID(), value }
}

function makeDrafts(items: string[]): BulletDraft[] {
  return items.length > 0 ? items.map(makeDraft) : [makeDraft('')]
}

function compactBullets(values: string[]): string[] {
  return values
    .map((line) => line.replace(/^\s*(?:[-*•]|[0-9]+[.)])\s*/, '').trim())
    .filter(Boolean)
}

function sameBullets(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((bullet, index) => bullet === right[index])
}

function ScopeBulletEditor({
  label,
  items,
  onChange,
  disabled,
  moduleIndex,
  tone,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  disabled: boolean
  moduleIndex: number
  tone: 'included' | 'excluded'
}) {
  const [drafts, setDrafts] = useState<BulletDraft[]>(() => makeDrafts(items))
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const focusIndex = useRef<number | null>(null)
  const hintId = `scope-${tone}-${moduleIndex}-hint`
  const draftValues = drafts.map((draft) => draft.value)
  const filledCount = compactBullets(draftValues).length
  const hasBlankDraft = drafts.some((draft) => !draft.value.trim())
  const atLimit = drafts.length >= SCOPE_MODULE_LIMITS.maxBulletCount

  useEffect(() => {
    if (!sameBullets(compactBullets(drafts.map((draft) => draft.value)), items)) {
      setDrafts(makeDrafts(items))
    }
  }, [drafts, items])

  useEffect(() => {
    if (focusIndex.current === null) return
    inputRefs.current[focusIndex.current]?.focus()
    focusIndex.current = null
  })

  const updateDraft = (index: number, value: string) => {
    const next = drafts.map((draft, current) => (current === index ? { ...draft, value } : draft))
    setDrafts(next)
    onChange(compactBullets(next.map((draft) => draft.value)))
  }

  const removeDraft = (index: number, nextFocusIndex = Math.max(0, index - 1)) => {
    const next = drafts.filter((_, current) => current !== index)
    const nextDrafts = next.length > 0 ? next : [makeDraft('')]
    focusIndex.current = Math.min(nextFocusIndex, nextDrafts.length - 1)
    setDrafts(nextDrafts)
    onChange(compactBullets(nextDrafts.map((draft) => draft.value)))
  }

  const addDraft = (afterIndex = drafts.length - 1) => {
    const blankIndex = drafts.findIndex((draft) => !draft.value.trim())
    if (blankIndex >= 0) {
      inputRefs.current[blankIndex]?.focus()
      return
    }
    if (atLimit) return
    const next = [
      ...drafts.slice(0, afterIndex + 1),
      makeDraft(''),
      ...drafts.slice(afterIndex + 1),
    ]
    focusIndex.current = afterIndex + 1
    setDrafts(next)
  }

  const addPastedBullets = () => {
    const pasted = compactBullets(pasteText.split(/\r?\n/))
    const current = compactBullets(drafts.map((draft) => draft.value))
    const available = SCOPE_MODULE_LIMITS.maxBulletCount - current.length
    const added = pasted.slice(0, available)

    if (added.length === 0) {
      setPasteFeedback(
        available === 0
          ? 'Ya has alcanzado el límite de puntos.'
          : 'No hemos detectado ningún punto.',
      )
      return
    }

    const next = [...current, ...added]
    setDrafts(makeDrafts(next))
    onChange(next)
    setPasteText('')
    setPasteOpen(false)
    setPasteFeedback(
      added.length === pasted.length
        ? `${added.length} ${added.length === 1 ? 'punto añadido' : 'puntos añadidos'}.`
        : `Se han añadido ${added.length} de ${pasted.length} puntos por el límite.`,
    )
  }

  const accentClass =
    tone === 'included'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : 'bg-muted text-muted-foreground'

  return (
    <section
      aria-labelledby={`scope-${tone}-${moduleIndex}-label`}
      className="border-border bg-muted/20 rounded-lg border p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 id={`scope-${tone}-${moduleIndex}-label`} className="text-sm font-medium">
            {label}
          </h3>
          <p id={hintId} className="text-muted-foreground mt-0.5 text-[11px]">
            Un punto por fila. Pulsa Intro para crear el siguiente.
          </p>
        </div>
        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
          {filledCount}/{SCOPE_MODULE_LIMITS.maxBulletCount}
        </span>
      </div>
      <ol aria-label={`${label} en módulo ${moduleIndex + 1}`} className="flex flex-col gap-1.5">
        {drafts.map((draft, bulletIndex) => (
          <li key={draft.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${accentClass}`}
            >
              •
            </span>
            <Input
              ref={(element) => {
                inputRefs.current[bulletIndex] = element
              }}
              value={draft.value}
              onChange={(event) => updateDraft(bulletIndex, event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return
                if (event.key === 'Enter' && draft.value.trim()) {
                  event.preventDefault()
                  addDraft(bulletIndex)
                }
                if (event.key === 'Backspace' && !draft.value && bulletIndex > 0) {
                  event.preventDefault()
                  removeDraft(bulletIndex)
                }
              }}
              disabled={disabled}
              maxLength={SCOPE_MODULE_LIMITS.maxBulletLength}
              placeholder={bulletIndex === 0 ? 'Escribe un punto' : 'Siguiente punto'}
              aria-label={`${label}, punto ${bulletIndex + 1}`}
              aria-describedby={hintId}
              className="bg-background h-9"
            />
            <button
              type="button"
              onClick={() => removeDraft(bulletIndex)}
              disabled={disabled || (drafts.length === 1 && !draft.value)}
              aria-label={`Eliminar punto ${bulletIndex + 1} de ${label}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex size-8 shrink-0 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => addDraft()}
          disabled={disabled || (atLimit && !hasBlankDraft)}
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden /> Añadir punto
        </button>
        <button
          type="button"
          onClick={() => {
            setPasteOpen((open) => !open)
            setPasteFeedback(null)
          }}
          disabled={disabled || atLimit}
          aria-expanded={pasteOpen}
          aria-label={`Pegar texto en ${label}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium disabled:pointer-events-none disabled:opacity-50"
        >
          <ClipboardPaste className="size-3.5" aria-hidden /> Pegar texto
        </button>
      </div>
      {pasteOpen ? (
        <div className="border-border bg-background mt-3 rounded-md border border-dashed p-2">
          <Textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            rows={4}
            placeholder="Pega aquí una lista, cada línea se convertirá en un punto."
            aria-label={`Texto para añadir a ${label}`}
            className="min-h-24 resize-y text-sm"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPasteOpen(false)
                setPasteText('')
              }}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={addPastedBullets}
              disabled={!pasteText.trim()}
              aria-label={`Convertir texto en puntos de ${label}`}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-2 py-1 text-xs font-medium disabled:pointer-events-none disabled:opacity-50"
            >
              Añadir puntos
            </button>
          </div>
        </div>
      ) : null}
      {pasteFeedback ? (
        <p role="status" className="text-muted-foreground mt-2 text-[11px]">
          {pasteFeedback}
        </p>
      ) : null}
    </section>
  )
}

/** Structured editor so scope can drive both client documents and later delivery prompts. */
export function ScopeModulesEditor({ modules, onChange, locked = false }: Props) {
  const disabled = locked
  const update = (index: number, patch: Partial<ScopeModule>) =>
    onChange(
      modules.map((module, current) => (current === index ? { ...module, ...patch } : module)),
    )
  const remove = (index: number) => onChange(modules.filter((_, current) => current !== index))
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction
    if (destination < 0 || destination >= modules.length) return
    const next = modules.slice()
    const current = next[index]
    const target = next[destination]
    if (!current || !target) return
    next[index] = target
    next[destination] = current
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {modules.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-4 text-xs">
          Define cada módulo para dejar claro qué entra —y qué no— antes de aceptar la propuesta.
        </div>
      ) : null}
      <ol aria-label="Módulos incluidos" className="flex flex-col gap-3">
        {modules.map((module, index) => (
          <li key={module.id} className="border-border bg-background rounded-md border p-3">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="text-muted-foreground w-6 shrink-0 text-center text-[11px] font-semibold tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-muted-foreground flex-1 text-[11px] font-medium tracking-wide uppercase">
                Módulo
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={disabled || index === 0}
                aria-label={`Subir módulo ${index + 1}`}
                className="text-muted-foreground hover:bg-accent inline-flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={disabled || index === modules.length - 1}
                aria-label={`Bajar módulo ${index + 1}`}
                className="text-muted-foreground hover:bg-accent inline-flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={disabled}
                aria-label={`Eliminar módulo ${index + 1}`}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <Input
                  value={module.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                  disabled={disabled}
                  maxLength={SCOPE_MODULE_LIMITS.maxTitleLength}
                  placeholder="Nombre del módulo"
                  aria-label={`Nombre del módulo ${index + 1}`}
                  className="h-8 text-sm font-medium"
                />
                <div className="grid gap-1">
                  <label
                    htmlFor={`scope-module-duration-${module.id}`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Plazo estimado
                  </label>
                  <Select
                    id={`scope-module-duration-${module.id}`}
                    value={
                      module.duration_mode === 'custom'
                        ? 'custom'
                        : String(module.duration_weeks ?? 1)
                    }
                    onChange={(event) => {
                      if (event.target.value === 'custom') {
                        update(index, {
                          duration_mode: 'custom',
                          duration_weeks: undefined,
                          duration_custom: module.duration_custom ?? '',
                        })
                        return
                      }
                      update(index, {
                        duration_mode: 'weeks',
                        duration_weeks: Number(event.target.value),
                        duration_custom: undefined,
                      })
                    }}
                    disabled={disabled}
                    aria-label={`Plazo estimado del módulo ${index + 1}`}
                    className="h-8 text-sm"
                  >
                    {SCOPE_MODULE_DURATION_WEEKS.map((weeks) => (
                      <option key={weeks} value={weeks}>
                        {scopeModuleDurationLabel(weeks)}
                      </option>
                    ))}
                    <option value="custom">Personalizado</option>
                  </Select>
                  {module.duration_mode === 'custom' ? (
                    <Input
                      value={module.duration_custom ?? ''}
                      onChange={(event) => update(index, { duration_custom: event.target.value })}
                      disabled={disabled}
                      maxLength={32}
                      placeholder="p. ej. 3 meses"
                      aria-label={`Duración personalizada del módulo ${index + 1}`}
                      className="h-8 text-sm"
                    />
                  ) : null}
                  {module.duration_mode === 'custom' ? (
                    <p className="text-muted-foreground text-xs">
                      Formato: 10 días, 2 semanas o 3 meses.
                    </p>
                  ) : null}
                </div>
                <Textarea
                  value={module.description ?? ''}
                  onChange={(event) => update(index, { description: event.target.value })}
                  disabled={disabled}
                  maxLength={SCOPE_MODULE_LIMITS.maxDescriptionLength}
                  rows={3}
                  placeholder="Descripción: qué resuelve y para quién"
                  aria-label={`Descripción del módulo ${index + 1}`}
                  className="resize-y text-sm"
                />
                <Textarea
                  value={module.notes ?? ''}
                  onChange={(event) => update(index, { notes: event.target.value })}
                  disabled={disabled}
                  maxLength={SCOPE_MODULE_LIMITS.maxNotesLength}
                  rows={2}
                  placeholder="Notas o dependencias del módulo"
                  aria-label={`Notas del módulo ${index + 1}`}
                  className="resize-y text-sm"
                />
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <ScopeBulletEditor
                  label="Incluido"
                  items={module.included}
                  onChange={(included) => update(index, { included })}
                  disabled={disabled}
                  moduleIndex={index}
                  tone="included"
                />
                <ScopeBulletEditor
                  label="No incluido"
                  items={module.excluded}
                  onChange={(excluded) => update(index, { excluded })}
                  disabled={disabled}
                  moduleIndex={index}
                  tone="excluded"
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onChange([...modules, createEmptyScopeModule()])}
        disabled={disabled || modules.length >= SCOPE_MODULE_LIMITS.maxCount}
        className="text-primary inline-flex w-fit items-center gap-1.5 text-xs font-medium hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden /> Añadir módulo
      </button>
    </div>
  )
}
