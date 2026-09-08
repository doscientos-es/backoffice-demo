'use client'

import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'
import { todayIsoLocal } from '@/lib/utils/date'

type CallDateFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
}

/** Date of the actual call, independent from when its record was created. */
export function CallDateField({ id, value, onChange }: CallDateFieldProps) {
  const today = todayIsoLocal()

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        Fecha de llamada
      </Label>
      <div className="flex gap-1">
        <DateField id={id} value={value} onChange={onChange} max={today} required />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onChange(today)}
          disabled={value === today}
        >
          Hoy
        </Button>
      </div>
    </div>
  )
}
