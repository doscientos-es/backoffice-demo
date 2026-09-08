import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'

import { UploadForm } from '../upload-form'

export const metadata: Metadata = { title: 'Subir documento · doscientos' }

export default async function NewInternalDocPage() {
  const user = await requireUser()

  // Viewers cannot upload
  if (user.role === 'viewer') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Subir documento"
          back={<BackLink href="/internal-docs" label="Volver" />}
        />
        <p className="text-muted-foreground text-sm">No tienes permiso para subir documentos.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subir documento interno"
        description="Añade un documento a la biblioteca interna de la empresa."
        back={<BackLink href="/internal-docs" label="Volver a docs internos" />}
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <UploadForm />
        </CardContent>
      </Card>
    </div>
  )
}
