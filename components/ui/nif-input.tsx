'use client'

/**
 * NifInput (offline) – NIF/NIE/CIF field with instant checksum validation.
 * Uses validateNifEs() — no network call. Shows ✓/✗ badge after typing.
 *
 * For EU VAT VIES verification (clients), see app/(app)/clients/nif-input.tsx.
 */

import { CheckCircle, XCircle } from 'lucide-react'
import { useState } from 'react'

import { validateNifEs } from '@/lib/vies/nif'

import { Input } from './input'

type State = 'idle' | 'valid' | 'invalid'

interface NifInputOfflineProps {
  id: string
  name: string
  defaultValue?: string | null
  placeholder?: string
}

function computeState(raw: string): { state: State; message: string } {
  const cleaned = raw.trim().replace(/[\s.-]/g, '')
  if (cleaned.length < 9) return { state: 'idle', message: '' }
  const result = validateNifEs(raw)
  return result.valid
    ? { state: 'valid', message: '' }
    : { state: 'invalid', message: result.message }
}

export function NifInputOffline({
  id,
  name,
  defaultValue = '',
  placeholder = 'B12345678',
}: NifInputOfflineProps) {
  const initial = computeState(defaultValue ?? '')
  const [state, setState] = useState<State>(initial.state)
  const [message, setMessage] = useState<string>(initial.message)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { state: s, message: m } = computeState(e.target.value)
    setState(s)
    setMessage(m)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Input
          id={id}
          name={name}
          maxLength={20}
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          autoComplete="off"
          onChange={handleChange}
          className={state !== 'idle' ? 'pr-9' : undefined}
        />
        {state !== 'idle' && (
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
            {state === 'valid' ? (
              <CheckCircle className="h-4 w-4 text-green-600" aria-label="NIF válido" />
            ) : (
              <XCircle className="text-destructive h-4 w-4" aria-label="NIF inválido" />
            )}
          </span>
        )}
      </div>
      {state === 'invalid' && message && (
        <p className="text-destructive flex items-center gap-1 text-[11px]">{message}</p>
      )}
    </div>
  )
}
