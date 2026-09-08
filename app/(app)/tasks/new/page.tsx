import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import { TaskNewForm } from './task-new-form'

export const metadata = { title: 'Nueva tarea · doscientos' }
export const dynamic = 'force-dynamic'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string; lead_id?: string; client_id?: string }>
}) {
  const user = await requireUser()
  const {
    project_id: presetProject,
    lead_id: presetLead,
    client_id: presetClient,
  } = await searchParams
  const supabase = await createServerClient()

  const [{ data: projects }, { data: leads }, { data: clients }, { data: members }] =
    await Promise.all([
      supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('leads').select('id, name').is('deleted_at', null).order('created_at', {
        ascending: false,
      }),
      supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('team_members').select('id, name').is('deleted_at', null).order('name'),
    ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva tarea"
        description="Crea trabajo asignable y rastreable."
        back={<BackLink href="/tasks" label="Volver a tareas" />}
      />

      <Card>
        <CardContent className="pt-6">
          <TaskNewForm
            projects={(projects ?? []) as Array<{ id: string; name: string }>}
            leads={(leads ?? []) as Array<{ id: string; name: string }>}
            clients={(clients ?? []) as Array<{ id: string; name: string }>}
            members={(members ?? []) as Array<{ id: string; name: string }>}
            defaults={{ project_id: presetProject, lead_id: presetLead, client_id: presetClient }}
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
