'use client'

import type { ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './combobox'

export interface EntityOption {
  id: string
  label: string
  sublabel?: string | null
  leading?: ReactNode
}

interface EntityComboboxProps {
  id?: string
  items: EntityOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  name?: string
  disabled?: boolean
  required?: boolean
  'aria-label'?: string
  /**
   * Optional custom renderer for each item in the dropdown list.
   * Receives the full EntityOption; must return the inner content of the item
   * (the ComboboxItem wrapper is added automatically).
   */
  renderItem?: (item: EntityOption) => ReactNode
}

/** Focus the next tabbable element after `el` in DOM order. */
function focusNextAfter(el: HTMLElement): void {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        'input:not([disabled]):not([type="hidden"])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"]):not([disabled])',
      ].join(', '),
    ),
  )
  const idx = all.indexOf(el)
  if (idx !== -1 && idx + 1 < all.length) all[idx + 1]?.focus()
}

/**
 * Generic searchable combobox for selecting a single entity (lead, client, etc.).
 *
 * Improvements over the raw primitive:
 * - **Inline ghost text**: while typing, the best matching label suffix is shown
 *   in grey directly inside the input field.
 * - **Tab to accept**: pressing Tab when a ghost suggestion is visible selects
 *   it and moves focus to the next form field automatically.
 * - **Click → focus next**: selecting an item via click (or Enter) also moves
 *   focus to the next tabbable field.
 * - **autoHighlight**: the first matching list item is always pre-highlighted so
 *   Enter always picks the top result.
 */
export function EntityCombobox({
  id,
  items,
  value,
  onChange,
  placeholder = '— Selecciona —',
  className,
  name,
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
  renderItem,
}: EntityComboboxProps) {
  const [inputValue, setInputValue] = useState('')
  // Capture the real <input> element on first focus so click handlers can use it
  const inputElRef = useRef<HTMLInputElement | null>(null)

  // Ghost text = the suffix of the best label that starts with what was typed
  const { ghostText, bestMatch } = useMemo(() => {
    if (!inputValue || value) return { ghostText: '', bestMatch: null }
    const lower = inputValue.toLowerCase()
    const match = items.find((item) => item.label.toLowerCase().startsWith(lower))
    if (!match) return { ghostText: '', bestMatch: null }
    return { ghostText: match.label.slice(inputValue.length), bestMatch: match }
  }, [inputValue, items, value])

  function handleValueChange(v: string | null) {
    onChange(v ?? '')
    if (v) {
      // After clicking / pressing Enter on an item, move focus to the next field
      const el = inputElRef.current
      setTimeout(() => {
        if (el) focusNextAfter(el)
      }, 80)
    }
  }

  return (
    <Combobox
      items={items.map((item) => item.id)}
      value={value}
      onValueChange={handleValueChange}
      onInputValueChange={(v) => setInputValue(v)}
      disabled={disabled}
      // Only auto-highlight when there is an active name-based ghost match.
      // When searching by company (sublabel) there is no ghost text, so the
      // first result should not be silently pre-selected.
      autoHighlight={!!bestMatch}
      // Include the sublabel so the library's built-in filter matches both
      // the name *and* the company/sublabel while typing.
      itemToStringLabel={(v: string) => {
        const item = items.find((i) => i.id === v)
        if (!item) return v ?? ''
        return item.sublabel ? `${item.label} · ${item.sublabel}` : item.label
      }}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showClear={!!value}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        className={className ?? 'w-full'}
        onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
          inputElRef.current = e.currentTarget
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          // Tab + active ghost text → accept suggestion & focus next field
          if (e.key === 'Tab' && bestMatch) {
            e.preventDefault()
            const inputEl = e.currentTarget as HTMLInputElement
            onChange(bestMatch.id)
            setTimeout(() => focusNextAfter(inputEl), 50)
          }
        }}
      >
        {/* Ghost text overlay — lives inside InputGroup (position:relative) */}
        {ghostText && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden pr-8 pl-2.5 text-base select-none md:text-sm"
          >
            {/* Invisible spacer that pushes ghost text to cursor position */}
            <span className="invisible whitespace-pre">{inputValue}</span>
            {/* Visible grey completion */}
            <span className="text-muted-foreground/40 truncate">{ghostText}</span>
          </div>
        )}
      </ComboboxInput>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <ComboboxContent>
        <ComboboxEmpty>No se encontraron coincidencias</ComboboxEmpty>
        <ComboboxList>
          {(id: string) => {
            const item = items.find((option) => option.id === id)
            if (!item) return null
            return (
              <ComboboxItem key={item.id} value={item.id}>
                {renderItem ? (
                  renderItem(item)
                ) : (
                  <>
                    {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-muted-foreground max-w-[45%] truncate text-xs">
                        {item.sublabel}
                      </span>
                    )}
                  </>
                )}
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
