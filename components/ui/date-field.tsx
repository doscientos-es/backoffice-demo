'use client'

import { CalendarDays } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useRef, useState } from 'react'

import { InputGroup, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'
import { displayToIso, isoToDisplay, maskDate } from '@/lib/utils/date-field'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BaseProps = {
  id?: string
  required?: boolean
  disabled?: boolean
  /** Native picker bounds, ISO `yyyy-MM-dd`. */
  min?: string
  max?: string
  className?: string
  'aria-label'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
  'aria-describedby'?: string
}

/** Uncontrolled: value lives in the form DOM (server actions / FormData). */
type UncontrolledProps = BaseProps & {
  /** Field name submitted in FormData. Required for uncontrolled usage. */
  name: string
  defaultValue?: string | null
  value?: never
  onChange?: never
}

/** Controlled: parent owns the ISO value (autosave editors, etc.). */
type ControlledProps = BaseProps & {
  name?: string
  /** ISO `yyyy-MM-dd` value controlled by the parent. */
  value: string
  onChange: (iso: string) => void
  defaultValue?: never
}

type Props = UncontrolledProps | ControlledProps

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Date input with a Spanish (`dd/mm/aaaa`) display format.
 *
 * - **Uncontrolled** (pass `name` + optional `defaultValue`): submits ISO
 *   `yyyy-MM-dd` via a hidden `<input>`, so server actions and Zod schemas are
 *   unaffected.
 * - **Controlled** (pass `value` + `onChange`): parent owns the ISO string;
 *   `onChange` fires on blur (after typing) or immediately when the native OS
 *   calendar picker is used.
 *
 * The native OS calendar is one click away (calendar-icon button), avoiding
 * the browser-locale format of a bare `<input type="date">`.
 */
export function DateField(props: Props) {
  const { id, required = false, disabled = false, min, max, className } = props

  const isControlled = 'onChange' in props && props.onChange !== undefined

  const reactId = useId()
  const fieldId = id ?? (props.name ? `${props.name}-${reactId}` : reactId)

  // Internal ISO state (source of truth while user types)
  const [internalIso, setInternalIso] = useState<string>(() =>
    isControlled
      ? ((props as ControlledProps).value ?? '')
      : ((props as UncontrolledProps).defaultValue ?? ''),
  )
  const [text, setText] = useState(() => isoToDisplay(internalIso))
  const nativeRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLInputElement>(null)
  // Stable ref so the effect below can read internalIso without being in deps
  const internalIsoRef = useRef(internalIso)
  internalIsoRef.current = internalIso

  // Controlled value from parent (undefined in uncontrolled mode)
  const controlledValue = isControlled ? (props as ControlledProps).value : undefined

  // Sync from parent when controlled value changes externally (and not focused)
  useEffect(() => {
    if (!isControlled || controlledValue === undefined) return
    const externalIso = controlledValue ?? ''
    if (externalIso !== internalIsoRef.current && document.activeElement !== textRef.current) {
      setInternalIso(externalIso)
      setText(isoToDisplay(externalIso))
    }
  }, [isControlled, controlledValue])

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const masked = maskDate(raw)
    setText(masked)
    const iso = displayToIso(masked)
    setInternalIso(iso)
  }

  function handleBlur() {
    // Reformat on blur: either pretty-print a valid date or clear partial input
    setText(internalIso ? isoToDisplay(internalIso) : '')
    if (isControlled) {
      ;(props as ControlledProps).onChange(internalIso)
    }
  }

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value
    setInternalIso(iso)
    setText(isoToDisplay(iso))
    if (isControlled) {
      ;(props as ControlledProps).onChange(iso)
    }
  }

  function openNativePicker() {
    const el = nativeRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') el.showPicker()
    else el.focus()
  }

  return (
    <div className="relative">
      {/* Hidden submission input — only rendered in uncontrolled mode */}
      {!isControlled && props.name && <input type="hidden" name={props.name} value={internalIso} />}

      <InputGroup className={className} data-disabled={disabled || undefined}>
        <input
          ref={textRef}
          id={fieldId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          required={required}
          disabled={disabled}
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}
          data-slot="input-group-control"
          aria-label={props['aria-label']}
          aria-invalid={props['aria-invalid']}
          aria-describedby={props['aria-describedby']}
          className="placeholder:text-muted-foreground flex-1 rounded-none border-0 bg-transparent px-2.5 py-1 text-base outline-none disabled:pointer-events-none disabled:cursor-not-allowed md:text-sm"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            aria-label="Abrir calendario"
            disabled={disabled}
            onClick={openNativePicker}
          >
            <CalendarDays />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Hidden native control: only powers the OS calendar picker. */}
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        min={min}
        max={max}
        value={internalIso}
        onChange={handleNativeChange}
        className={cn('pointer-events-none absolute right-2 bottom-0 size-0 opacity-0')}
      />
    </div>
  )
}
