'use client'

import { Database as DatabaseBackup, Download, LoaderCircle as Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

import { triggerBackofficeBackup } from './actions'

type ExportTable = { value: string; label: string }

export function BackupActions({
  runnerConfigured,
  tables,
  showBackupAction = true,
  showExportActions = true,
}: {
  runnerConfigured: boolean
  tables: readonly ExportTable[]
  showBackupAction?: boolean
  showExportActions?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [table, setTable] = useState(tables[0]?.value ?? '')
  const csvHref = `/api/data-export?format=csv&table=${encodeURIComponent(table)}`

  function forceBackup() {
    startTransition(async () => {
      const result = await triggerBackofficeBackup()
      if (result.ok) sileo.success({ title: 'Copia de seguridad iniciada' })
      else sileo.error({ title: result.error })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {showBackupAction ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={forceBackup}
            disabled={!runnerConfigured || pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DatabaseBackup className="size-4" />
            )}
            {pending ? 'Creando copia…' : 'Crear copia ahora'}
          </Button>
          {!runnerConfigured ? (
            <span className="text-muted-foreground text-xs">
              La copia automática se activará al configurar el runner.
            </span>
          ) : null}
        </div>
      ) : null}

      {showExportActions ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <a href="/api/data-export?format=json" download>
              <Download className="size-4" />
              Descargar datos actuales (JSON)
            </a>
          </Button>
          <Select
            value={table}
            onChange={(event) => setTable(event.target.value)}
            aria-label="Tabla actual para exportar como CSV"
            className="w-52"
          >
            {tables.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button asChild variant="outline" disabled={!table}>
            <a href={csvHref} download>
              <Download className="size-4" />
              Descargar datos actuales (CSV / Excel)
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
