'use client'

import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'
import { useFormDirty } from '@/lib/hooks/use-form-dirty'
import type { GithubSyncModeType, ProjectStatusType } from '@/lib/schemas/project'

import { updateProject } from '../actions'
import type { ProjectBillingType } from '../billing-section'
import type { GitHubSyncMode } from '../github-sync-section'
import { ProjectFormFields } from '../project-form-fields'

type Project = {
  id: string
  client_id: string
  name: string
  status: string
  starts_at: string | null
  ends_at: string | null
  description: string | null
  billing_type: ProjectBillingType | null
  hourly_rate: number | null
  hourly_vat_rate: number | null
  github_sync_mode: GitHubSyncMode | null
  github_repo: string | null
  github_installation_id: number | null
  github_auto_sync: boolean | null
  version: number
}

interface Props {
  project: Project
  clients: Array<{ id: string; name: string }>
  /** Installation ID de la org, fallback cuando el proyecto no tiene uno propio. */
  orgDefaultInstallationId?: number | null
}

export function ProjectEditDialog({ project, clients, orgDefaultInstallationId = null }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const feedback = useFormFeedback()
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const fd = new FormData(e.currentTarget)
    const installIdRaw = fd.get('github_installation_id')?.toString() ?? ''
    const rateRaw = fd.get('hourly_rate')?.toString() ?? ''
    const vatRaw = fd.get('hourly_vat_rate')?.toString() ?? ''
    const res = await updateProject({
      id: project.id,
      expected_version: project.version,
      client_id: fd.get('client_id')?.toString() ?? '',
      name: fd.get('name')?.toString() ?? '',
      description: fd.get('description')?.toString() ?? '',
      status: (fd.get('status')?.toString() ?? 'planning') as ProjectStatusType,
      starts_at: fd.get('starts_at')?.toString() ?? '',
      ends_at: fd.get('ends_at')?.toString() ?? '',
      billing_type: (fd.get('billing_type')?.toString() ?? 'fixed') as ProjectBillingType,
      hourly_rate: rateRaw === '' ? '' : Number(rateRaw),
      hourly_vat_rate: vatRaw === '' ? 21 : Number(vatRaw),
      github_sync_mode: (fd.get('github_sync_mode')?.toString() ?? 'none') as GithubSyncModeType,
      github_auto_sync: !!fd.get('github_auto_sync'),
      github_repo: fd.get('github_repo')?.toString() ?? '',
      github_installation_id: installIdRaw === '' ? '' : Number(installIdRaw),
    })
    if (!res.ok) {
      if (res.code === 'conflict') setConflictOpen(true)
      else feedback.setError(res.error)
      return
    }
    feedback.setSuccess('Guardado')
    reset()
    setTimeout(() => {
      setOpen(false)
      router.refresh()
    }, 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) feedback.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
          <DialogDescription>Actualiza los datos del proyecto.</DialogDescription>
        </DialogHeader>
        <form
          key={project.version}
          ref={formRef}
          onSubmit={onSubmit}
          className="flex max-h-[70vh] flex-col"
        >
          <div className="scroll-fade no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <ProjectFormFields
              idPrefix={`edit-${project.id}`}
              clients={clients}
              showClientPlaceholder={false}
              orgDefaultInstallationId={orgDefaultInstallationId}
              defaults={{
                client_id: project.client_id,
                name: project.name,
                status: project.status,
                starts_at: project.starts_at,
                ends_at: project.ends_at,
                description: project.description,
                billing_type: project.billing_type ?? 'fixed',
                hourly_rate: project.hourly_rate,
                hourly_vat_rate: project.hourly_vat_rate,
                github_sync_mode: project.github_sync_mode ?? 'none',
                github_repo: project.github_repo,
                github_installation_id: project.github_installation_id,
                github_auto_sync: project.github_auto_sync ?? true,
              }}
            />
          </div>
          <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} isDisabled={!isDirty} pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
      <VersionConflictDialog
        open={conflictOpen}
        entityName="proyecto"
        onKeepEditing={() => setConflictOpen(false)}
        onReload={() => {
          setConflictOpen(false)
          setOpen(false)
          router.refresh()
        }}
      />
    </Dialog>
  )
}
