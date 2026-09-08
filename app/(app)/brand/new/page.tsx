import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'

import { UploadAssetForm } from '../upload-form'

export const metadata: Metadata = { title: 'Subir asset · doscientos' }

export default async function NewAssetPage() {
  const user = await requireUser()

  if (user.role === 'viewer') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Subir asset" back={<BackLink href="/brand" label="Volver" />} />
        <p className="text-muted-foreground text-sm">No tienes permiso para subir assets.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subir asset de marca"
        description="Añade logos, isotipos, backgrounds u otros recursos visuales de la empresa."
        back={<BackLink href="/brand" label="Volver a marca" />}
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <UploadAssetForm />
        </CardContent>
      </Card>
    </div>
  )
}
