import { BackupsCard } from '@/app/(app)/webs/_components/backups-card'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePageRole } from '@/lib/auth'
import { BACKOFFICE_BACKUP_SLUG, getBackofficeBackupSetup } from '@/lib/backups/backoffice'
import { EXPORTABLE_TABLES } from '@/lib/exports/data'
import { isFileBrowserConfigured } from '@/lib/filebrowser'

import { BackupActions } from './backup-actions'

export const metadata = { title: 'Copias de seguridad · Ajustes · doscientos' }
export const dynamic = 'force-dynamic'

function labelForTable(table: string) {
  return table.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default async function BackupSettingsPage() {
  await requirePageRole(['owner', 'admin'])
  const setup = getBackofficeBackupSetup()
  const archiveConfigured = isFileBrowserConfigured()
  const tables = EXPORTABLE_TABLES.map((value) => ({ value, label: labelForTable(value) }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Copias de seguridad"
        description="Exportaciones de los datos ficticios de la demo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Descargar los datos actuales</CardTitle>
          <CardDescription>
            Descarga un JSON completo o el CSV de una tabla para abrirlo en Excel. Es una
            exportación puntual del estado actual, no una copia restaurable del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <BackupActions
            runnerConfigured={setup.configured}
            tables={tables}
            showBackupAction={false}
          />
          <p className="text-muted-foreground text-sm">
            Las exportaciones se generan a partir de los datos JSON incluidos en esta demo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Respaldo automático</CardTitle>
              <CardDescription>
                Esta función está desactivada: la demo no mantiene servicios ni archivos remotos.
              </CardDescription>
            </div>
            <Badge variant={setup.configured ? 'success' : 'neutral'}>
              {setup.configured ? 'Activo' : 'No disponible en demo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Los datos se reinician al recargar la demo y nunca se envían a un servidor externo.
          </p>
          <BackupActions
            runnerConfigured={setup.configured}
            tables={tables}
            showExportActions={false}
          />
        </CardContent>
      </Card>

      {archiveConfigured ? (
        <BackupsCard clientSlug={BACKOFFICE_BACKUP_SLUG} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historial de copias</CardTitle>
            <CardDescription>
              No hay historial remoto en la demo pública.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
