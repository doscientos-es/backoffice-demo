'use client'

import {
  TriangleAlert as AlertTriangle,
  Building2,
  CheckCircle,
  LoaderCircle as Loader2,
  Search,
  XCircle,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import type { OpenMercantilOfficer } from '@/lib/openmercantil/client'
import { validateNifEs } from '@/lib/vies/nif'

import { validateVat } from './actions'

export type AutofillData = {
  name?: string
  province?: string
  city?: string
  address?: string
  companyType?: string
  companyStatus?: string
  officers?: OpenMercantilOfficer[]
}

type VatState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'valid'
      name?: string
      address?: string
      source?: 'vies' | 'openmercantil' | 'es-checksum'
      companyStatus?: string
      province?: string
      city?: string
      companyType?: string
      officers?: OpenMercantilOfficer[]
    }
  | { status: 'not_found'; message: string }
  | { status: 'invalid'; message: string }

/** Returns offline NIF checksum result for ES numbers, null otherwise. */
function offlineCheck(raw: string): { valid: boolean; message?: string } | null {
  const v = raw
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')
  if (v.length < 2) return null
  const cc = v.slice(0, 2)
  const num = cc === 'ES' ? v.slice(2) : /^[A-Z]{2}/.test(cc) ? null : v
  if (!num) return null
  if (num.length < 9) return null
  const r = validateNifEs(num)
  return r.valid ? { valid: true } : { valid: false, message: r.message }
}

/**
 * NIF/CIF input with:
 * - Instant offline checksum (Spanish NIF/NIE/CIF as you type)
 * - "Verificar" button: queries Registro Mercantil (primary) then VIES (fallback)
 * - `onAutofillAction` callback fired when company data is found — lets the parent
 *   pre-populate name, city, and province fields.
 */
export function NifInput({
  id,
  defaultValue = '',
  onAutofillAction,
}: {
  id: string
  defaultValue?: string | null
  onAutofillAction?: (data: AutofillData) => void
}) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [state, setState] = useState<VatState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  const verify = useCallback(async () => {
    const nif = inputRef.current?.value.trim() ?? value.trim()
    if (!nif) {
      setState({ status: 'invalid', message: 'Introduce un NIF/CIF/VAT primero.' })
      return
    }
    setState({ status: 'loading' })
    const result = await validateVat(nif)
    if (result.valid) {
      setState({
        status: 'valid',
        name: result.name,
        address: result.address,
        source: result.source,
        companyStatus: result.companyStatus,
        province: result.province,
        city: result.city,
        companyType: result.companyType,
        officers: result.officers,
      })
      // Fire autofill callback when we have enriched company data
      if (result.source === 'openmercantil' && onAutofillAction) {
        onAutofillAction({
          name: result.name,
          province: result.province,
          city: result.city,
          address: result.address,
          companyType: result.companyType,
          companyStatus: result.companyStatus,
          officers: result.officers,
        })
      }
    } else if (result.reason === 'not_found') {
      setState({ status: 'not_found', message: result.message })
    } else {
      setState({ status: 'invalid', message: result.message })
    }
  }, [value, onAutofillAction])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setState({ status: 'idle' })
  }

  const offline = state.status === 'idle' ? offlineCheck(value) : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          name="nif"
          maxLength={20}
          value={value}
          onChange={handleChange}
          placeholder="B12345678 · ESB12345678"
          autoComplete="off"
          className="flex-1"
        />
        <button
          type="button"
          onClick={verify}
          disabled={state.status === 'loading' || !value.trim()}
          title="Buscar en Registro Mercantil y VIES"
          className="border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.status === 'loading' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}
          Verificar
        </button>
      </div>

      {/* Offline checksum (instant, no network) */}
      {state.status === 'idle' && offline && (
        <p
          className={`flex items-start gap-1.5 text-xs ${offline.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
        >
          {offline.valid ? (
            <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{offline.valid ? 'Formato correcto' : offline.message}</span>
        </p>
      )}

      {/* Found in Registro Mercantil or VIES */}
      {state.status === 'valid' && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {state.source === 'openmercantil' ? (
              <span className="font-medium">Registro Mercantil</span>
            ) : state.source === 'es-checksum' ? (
              <span className="font-medium">NIF válido</span>
            ) : (
              <span className="font-medium">VIES</span>
            )}
            {state.name ? ` · ${state.name}` : ''}
            {state.city ? `, ${state.city}` : ''}
            {state.province && state.province !== state.city ? ` (${state.province})` : ''}
            {state.companyStatus && state.companyStatus.toUpperCase() !== 'ACTIVA' ? (
              <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">
                · {state.companyStatus}
              </span>
            ) : null}
          </span>
        </p>
      )}

      {/* Not found in VIES (amber, not an error for domestic companies) */}
      {state.status === 'not_found' && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{state.message}</span>
        </p>
      )}

      {/* Truly invalid format */}
      {state.status === 'invalid' && (
        <p className="text-destructive flex items-start gap-1.5 text-xs">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{state.message}</span>
        </p>
      )}

      {/* Hint shown only when format is valid and we haven't verified yet */}
      {state.status === 'idle' && offline?.valid && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Building2 className="size-3 shrink-0" />
          Pulsa &quot;Verificar&quot; para buscar la empresa en el Registro Mercantil.
        </p>
      )}
    </div>
  )
}
