import { TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { requirePageRole } from '@/lib/auth'
import { availablePlatforms } from '@/lib/social/service'

import { ComposeForm } from './_components/compose-form'

export const metadata: Metadata = { title: 'Nueva publicación · Social' }
export const dynamic = 'force-dynamic'

export default async function ComposePage() {
  await requirePageRole(['owner', 'admin', 'member'])
  const available = availablePlatforms()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva publicación"
        description="Redacta una vez y publica en varias redes a la vez."
        back={<BackLink href="/social" label="Volver a Social" />}
      />

      {available.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-500/10 p-3 text-sm text-amber-700 dark:border-amber-700/50 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            No hay ninguna red conectada todavía. Puedes guardar borradores, pero para publicar
            configura las credenciales de Instagram o Facebook.
          </p>
        </div>
      )}

      <ComposeForm available={available} />
    </div>
  )
}
