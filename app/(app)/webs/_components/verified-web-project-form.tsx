'use client'

import Link from 'next/link'
import { useTransition } from 'react'

import { usePasskeyVerification } from '@/components/security/use-passkey-verification'
import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import type { ActionResult } from '@/lib/actions/types'
import { userVerificationScope } from '@/lib/security/user-verification-scope'
import type { WebProjectDetail } from '@/lib/webs/types'

import { createWebProject, updateWebProject } from '../actions'
import { WebFormFields } from './web-form-fields'

type Props = {
  clients: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; client_id: string }>
  mode: 'create' | 'edit'
  projectId?: string
  defaults?: Partial<WebProjectDetail>
}

function credentialsChanged(
  formData: FormData,
  defaults: Partial<WebProjectDetail> | undefined,
  isCreate: boolean,
): boolean {
  const value = (name: string) => formData.get(name)?.toString().trim() ?? ''
  const current = {
    db_host: defaults?.db_host ?? '',
    db_port: defaults?.db_port?.toString() ?? '',
    db_name: defaults?.db_name ?? '',
    db_user: defaults?.db_user ?? '',
  }
  const next = {
    db_host: value('db_host'),
    db_port: value('db_port'),
    db_name: value('db_name'),
    db_user: value('db_user'),
  }
  return (
    value('db_pass').length > 0 ||
    Object.entries(next).some(([key, nextValue]) =>
      isCreate ? nextValue.length > 0 : nextValue !== current[key as keyof typeof current],
    )
  )
}

/** Handles the only UI path that can create or alter DB connection credentials. */
export function VerifiedWebProjectForm({ clients, projects, mode, projectId, defaults }: Props) {
  const feedback = useFormFeedback()
  const [pending, startTransition] = useTransition()
  const { challenge, verifyWithPasskey } = usePasskeyVerification()
  const isCreate = mode === 'create'
  const resource = isCreate ? 'web:create' : `web:${projectId}`

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    feedback.setPending()

    startTransition(async () => {
      if (credentialsChanged(formData, defaults, isCreate)) {
        const verification = await verifyWithPasskey(
          userVerificationScope('web.db_credentials.update', resource),
        )
        if (!verification.ok) {
          feedback.setError(verification.error)
          return
        }
      }

      const result = (
        isCreate ? await createWebProject(formData) : await updateWebProject(formData)
      ) as ActionResult<void>
      if (!result.ok) feedback.setError(result.error)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {projectId ? <input type="hidden" name="id" value={projectId} /> : null}
      <WebFormFields
        idPrefix={isCreate ? 'new' : 'edit'}
        clients={clients}
        projects={projects}
        defaults={defaults}
        autoFocusName={isCreate}
      />
      <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
        <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
        <Button asChild variant="ghost" size="sm">
          <Link href={isCreate ? '/webs' : `/webs/${projectId}`}>Cancelar</Link>
        </Button>
        <SubmitButton pendingLabel="Guardando…" loading={pending || feedback.pending}>
          {isCreate ? 'Crear web' : 'Guardar cambios'}
        </SubmitButton>
      </div>
      {challenge}
    </form>
  )
}
