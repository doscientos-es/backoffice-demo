'use client'

/**
 * IbanInput – IBAN field with instant offline checksum validation via ibantools.
 * Shows a success/error badge without any network call.
 */

import { isValidIBAN } from 'ibantools'
import { CheckCircle, XCircle } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@doscientos/ui'

interface IbanInputProps {
  id: string
  name: string
  defaultValue?: string
  placeholder?: string
}

type ValidationState = 'idle' | 'valid' | 'invalid'

function normalizeIban(raw: string): string {
  return raw.trim().replace(/\s/g, '').toUpperCase()
}

function computeIbanState(raw: string): ValidationState {
  const normalized = normalizeIban(raw)
  if (normalized.length < 15) return 'idle'
  return isValidIBAN(normalized) ? 'valid' : 'invalid'
}

export function IbanInput({
  id,
  name,
  defaultValue = '',
  placeholder = 'ES00 0000 0000 0000 0000 0000',
}: IbanInputProps) {
  const [state, setState] = useState<ValidationState>(() => computeIbanState(defaultValue))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setState(computeIbanState(e.target.value))
  }

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pr-9 font-mono"
        onChange={handleChange}
        autoComplete="off"
        spellCheck={false}
        maxLength={34}
      />
      {state !== 'idle' && (
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
          {state === 'valid' ? (
            <CheckCircle className="h-4 w-4 text-green-600" aria-label="IBAN válido" />
          ) : (
            <XCircle className="text-destructive h-4 w-4" aria-label="IBAN inválido" />
          )}
        </span>
      )}
    </div>
  )
}
