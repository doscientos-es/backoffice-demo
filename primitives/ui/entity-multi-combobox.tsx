'use client'

import { cn } from '../lib/utils'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from './combobox'
import type { EntityOption } from './entity-combobox'

export interface EntityMultiComboboxProps {
  id?: string
  items: EntityOption[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
}

/**
 * Generic searchable multi-select combobox. Selected entities render as
 * removable chips. Wraps the @base-ui/react Combobox primitives in
 * `multiple` mode with built-in filtering.
 */
export function EntityMultiCombobox({
  id,
  items,
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
  disabled = false,
  'aria-label': ariaLabel,
}: EntityMultiComboboxProps) {
  const anchor = useComboboxAnchor()
  const labelFor = (v: string) => {
    const item = items.find((i) => i.id === v)
    if (!item) return v
    return item.sublabel ? `${item.label} · ${item.sublabel}` : item.label
  }
  const itemFor = (v: string) => items.find((item) => item.id === v)

  return (
    <Combobox
      multiple
      items={items.map((item) => item.id)}
      value={value}
      onValueChange={(v: string[]) => onChange(v ?? [])}
      itemToStringLabel={labelFor}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className={cn('w-full', className)}>
        <ComboboxValue>
          {(selected: string[]) =>
            selected.map((v) => {
              const item = itemFor(v)
              return (
                <ComboboxChip key={v} aria-label={labelFor(v)}>
                  {item?.leading ? <span className="shrink-0">{item.leading}</span> : null}
                  <span className="max-w-[22ch] truncate">{item?.label ?? labelFor(v)}</span>
                </ComboboxChip>
              )
            })
          }
        </ComboboxValue>
        <ComboboxChipsInput
          id={id}
          placeholder={value.length ? '' : placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No se encontraron coincidencias</ComboboxEmpty>
        <ComboboxList>
          {(id: string) => {
            const item = items.find((option) => option.id === id)
            if (!item) return null

            return (
              <ComboboxItem key={item.id} value={item.id}>
                {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="text-muted-foreground max-w-[45%] truncate text-xs">
                    {item.sublabel}
                  </span>
                )}
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
