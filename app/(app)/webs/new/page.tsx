import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePageRole } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import { VerifiedWebProjectForm } from '../_components/verified-web-project-form'

export const metadata: Metadata = { title: 'Nueva web · doscientos' }
export const dynamic = 'force-dynamic'

export default async function NewWebPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string; client_id?: string }>
}) {
  await requirePageRole(['owner', 'admin'])
  const supabase = await createServerClient()
  const { project_id, client_id } = await searchParams
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('projects').select('id, name, client_id').is('deleted_at', null).order('name'),
  ])
  const projectOptions = (projects ?? []) as Array<{
    id: string
    name: string
    client_id: string
  }>
  const selectedProject = projectOptions.find((project) => project.id === project_id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nueva web" back={<BackLink href="/webs" label="Volver a webs" />} />
      <Card>
        <CardContent className="pt-6">
          <VerifiedWebProjectForm
            clients={(clients as Array<{ id: string; name: string }> | null) ?? []}
            projects={projectOptions}
            defaults={{
              project_id: selectedProject?.id ?? null,
              client_id: selectedProject?.client_id ?? client_id ?? null,
              is_client_visible: Boolean(selectedProject),
            }}
            mode="create"
          />
        </CardContent>
      </Card>
    </div>
  )
}
