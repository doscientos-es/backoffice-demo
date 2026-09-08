import type { Metadata } from 'next'
import Link from 'next/link'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { requireUser } from '@/lib/auth'
import { githubDefaultInstallationId } from '@/lib/env'
import { createServerClient } from '@/lib/supabase/server'
import { addDaysIsoLocal, todayIsoLocal } from '@/lib/utils/date'

import { createProject } from '../actions'
import { ProjectFormFields } from '../project-form-fields'

export const metadata: Metadata = { title: 'Nuevo proyecto · doscientos' }
export const dynamic = 'force-dynamic'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>
}) {
  await requireUser()
  const { client_id } = await searchParams
  const supabase = await createServerClient()

  const [{ data: clients }, { data: templates }] = await Promise.all([
    supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
    supabase
      .from('onboarding_templates')
      .select('id, name, description')
      .is('deleted_at', null)
      .order('position'),
  ])

  type Template = { id: string; name: string; description: string | null }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo proyecto"
        back={<BackLink href="/projects" label="Volver a proyectos" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={createProject} className="flex flex-col gap-5">
            <ProjectFormFields
              idPrefix="new"
              clients={(clients as Array<{ id: string; name: string }> | null) ?? []}
              autoFocusName
              orgDefaultInstallationId={githubDefaultInstallationId()}
              defaults={{
                client_id: client_id ?? '',
                starts_at: todayIsoLocal(),
                ends_at: addDaysIsoLocal(42),
              }}
            />

            {/* Onboarding checklist template selector */}
            {(templates as Template[] | null)?.length ? (
              <div className="border-border flex flex-col gap-2 border-t pt-4">
                <p className="text-sm font-medium">Checklist de onboarding</p>
                <p className="text-muted-foreground text-xs">
                  Elige una plantilla para generar la lista de tareas de inicio del proyecto.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {/* Empty option */}
                  <label className="border-border hover:bg-muted/40 has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors">
                    <input
                      type="radio"
                      name="template_id"
                      value=""
                      defaultChecked
                      className="accent-primary mt-0.5"
                    />
                    <span className="text-sm">
                      <span className="font-medium">Sin plantilla</span>
                      <span className="text-muted-foreground block text-xs">
                        Empezar con checklist vacío
                      </span>
                    </span>
                  </label>
                  {(templates as Template[]).map((t) => (
                    <label
                      key={t.id}
                      className="border-border hover:bg-muted/40 has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <input
                        type="radio"
                        name="template_id"
                        value={t.id}
                        className="accent-primary mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{t.name}</span>
                        {t.description ? (
                          <span className="text-muted-foreground block text-xs">
                            {t.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Creando…">Crear proyecto</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
