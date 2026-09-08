import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { DangerZone } from '@/components/ui/danger-zone'
import { SubmitButton } from '@/components/ui/submit-button'
import { requirePageRole } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { getWebProject } from '@/lib/webs/queries'

import { VerifiedWebProjectForm } from '../../_components/verified-web-project-form'
import { deleteWebProject } from '../../actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const site = await getWebProject(id)
  return { title: site ? `Editar ${site.name} · doscientos` : 'Editar web · doscientos' }
}

export default async function EditWebPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(['owner', 'admin'])
  const { id } = await params
  const supabase = await createServerClient()

  const [site, { data: clients }, { data: projects }] = await Promise.all([
    getWebProject(id),
    supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('projects').select('id, name, client_id').is('deleted_at', null).order('name'),
  ])

  if (!site) notFound()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Editar · ${site.name}`}
        back={<BackLink href={`/webs/${id}`} label="Volver al detalle" />}
      />

      <Card>
        <CardContent className="pt-6">
          <VerifiedWebProjectForm
            clients={(clients as Array<{ id: string; name: string }> | null) ?? []}
            projects={
              (projects as Array<{ id: string; name: string; client_id: string }> | null) ?? []
            }
            defaults={site}
            mode="edit"
            projectId={id}
          />
        </CardContent>
      </Card>

      <DangerZone
        title="Eliminar web"
        description="Esta acción es permanente. La web se eliminará del sistema."
      >
        <form action={deleteWebProject}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="destructive" pendingLabel="Eliminando…" size="sm">
            Eliminar web
          </SubmitButton>
        </form>
      </DangerZone>
    </div>
  )
}
