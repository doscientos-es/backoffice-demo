'use client'

import { useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { upsertToken } from '../actions'

export type BrandToken = {
  id: string
  token_group: 'color' | 'typography' | 'spacing' | 'radius' | 'shadow'
  key: string
  value: string
  value_dark: string | null
  description: string | null
  sort_order: number
}

const GROUP_LABELS = {
  color: 'Color',
  typography: 'Tipografía',
  spacing: 'Espaciado',
  radius: 'Radio',
  shadow: 'Sombra',
} as const

// HEX → OKLCH conversion (full gamut-safe implementation)
function hexToOklch(hex: string): string {
  const clean = hex.replace('#', '')
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)

  const x = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
  const y = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
  const z = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl

  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z)

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bval = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const C = Math.sqrt(a * a + bval * bval)
  let H = Math.atan2(bval, a) * (180 / Math.PI)
  if (H < 0) H += 360

  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`
}

// Extract HEX from value string for seeding the color picker
function extractHex(val: string): string {
  const match = val.match(/#[0-9a-fA-F]{6}/)
  return match ? match[0] : '#000000'
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  token?: BrandToken | null
}

export function TokenEditDialog({ open, onOpenChange, token }: Props) {
  const [pending, startTransition] = useTransition()
  const [group, setGroup] = useState<BrandToken['token_group']>(token?.token_group ?? 'color')
  const [lightValue, setLightValue] = useState(token?.value ?? '')
  const [darkValue, setDarkValue] = useState(token?.value_dark ?? '')
  const lightInputRef = useRef<HTMLInputElement>(null)
  const darkInputRef = useRef<HTMLInputElement>(null)

  const isColor = group === 'color'

  function handlePickerChange(field: 'light' | 'dark', hex: string) {
    const oklch = hexToOklch(hex)
    if (field === 'light') {
      setLightValue(oklch)
    } else {
      setDarkValue(oklch)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      id: token?.id,
      token_group: fd.get('token_group') as BrandToken['token_group'],
      key: (fd.get('key') as string).trim(),
      value: lightValue.trim(),
      value_dark: darkValue.trim() || undefined,
      description: (fd.get('description') as string).trim() || undefined,
      sort_order: token?.sort_order ?? 0,
    }
    startTransition(async () => {
      const res = await upsertToken(payload)
      if (res.ok) onOpenChange(false)
      else alert(res.error ?? 'Error al guardar')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{token ? 'Editar token' : 'Nuevo token'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <FormRow label="Grupo" htmlFor="token_group" required>
            <Select
              id="token_group"
              name="token_group"
              value={group}
              onChange={(e) => setGroup(e.target.value as BrandToken['token_group'])}
            >
              {Object.entries(GROUP_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Nombre del token" htmlFor="key" required>
            <Input
              id="key"
              name="key"
              required
              maxLength={80}
              placeholder="primary"
              defaultValue={token?.key ?? ''}
            />
          </FormRow>

          <FormRow label="Valor (light)" htmlFor="value" required>
            <div className="flex items-center gap-2">
              {isColor && (
                <label className="shrink-0 cursor-pointer" title="Seleccionar color">
                  <span
                    className="border-border block size-8 rounded border shadow-sm"
                    style={{ background: lightValue || '#000000' }}
                  />
                  <input
                    type="color"
                    aria-label="Seleccionar color light"
                    className="sr-only"
                    value={extractHex(lightValue)}
                    onChange={(e) => handlePickerChange('light', e.target.value)}
                  />
                </label>
              )}
              <Input
                ref={lightInputRef}
                id="value"
                name="value"
                required
                maxLength={400}
                placeholder={isColor ? 'oklch(0.5 0.15 120) o #2a4227' : '0.625rem'}
                value={lightValue}
                onChange={(e) => setLightValue(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </FormRow>

          {isColor && (
            <FormRow label="Valor (dark)" htmlFor="value_dark">
              <div className="flex items-center gap-2">
                <label className="shrink-0 cursor-pointer" title="Seleccionar color dark">
                  <span
                    className="border-border block size-8 rounded border shadow-sm"
                    style={{ background: darkValue || 'transparent' }}
                  />
                  <input
                    type="color"
                    aria-label="Seleccionar color dark"
                    className="sr-only"
                    value={extractHex(darkValue || '#000000')}
                    onChange={(e) => handlePickerChange('dark', e.target.value)}
                  />
                </label>
                <Input
                  ref={darkInputRef}
                  id="value_dark"
                  name="value_dark"
                  maxLength={400}
                  placeholder="oklch(0.922 0 0)"
                  value={darkValue}
                  onChange={(e) => setDarkValue(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </FormRow>
          )}

          {!isColor && (
            <FormRow label="Valor" htmlFor="value_other">
              <Input
                id="value_other"
                maxLength={400}
                placeholder="0.625rem"
                value={lightValue}
                onChange={(e) => setLightValue(e.target.value)}
              />
            </FormRow>
          )}

          <FormRow label="Descripción" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              maxLength={300}
              rows={2}
              placeholder="Uso de este token…"
              defaultValue={token?.description ?? ''}
            />
          </FormRow>

          <div className="border-border flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
