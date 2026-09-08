'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { FormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'
import { useActionForm } from '@/lib/hooks/use-action-form'

import { updateSubscription } from '../actions'
import { SubscriptionFormFields, type SubscriptionFormValues } from '../subscription-form-fields'

type Props = {
  id: string
  version: number
  clients: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  defaults: SubscriptionFormValues
}

/**
 * Client wrapper around the subscription edit form. Uses `useActionForm` so
 * validation errors and success feedback are surfaced inline — no redirect.
 */
export function SubscriptionEditForm({ id, version, clients, projects, defaults }: Props) {
  const router = useRouter()
  const [conflictOpen, setConflictOpen] = useState(false)
  const { state, pending, onSubmit } = useActionForm(
    async (fd) => {
      fd.append('id', id)
      fd.append('expected_version', String(version))
      return updateSubscription(fd)
    },
    {
      successMessage: 'Cambios guardados',
      onSuccess: () => router.refresh(),
      onFailure: (result) => {
        if (result.code !== 'conflict') return false
        setConflictOpen(true)
        return true
      },
    },
  )

  return (
    <>
      <form key={version} onSubmit={onSubmit} className="flex flex-col gap-6">
        <SubscriptionFormFields clients={clients} projects={projects} defaults={defaults} />
        <div className="flex items-center justify-end gap-3">
          <FormFeedback state={state} />
          <SubmitButton loading={pending}>Guardar cambios</SubmitButton>
        </div>
      </form>
      <VersionConflictDialog
        open={conflictOpen}
        entityName="suscripción"
        onKeepEditing={() => setConflictOpen(false)}
        onReload={() => {
          setConflictOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
