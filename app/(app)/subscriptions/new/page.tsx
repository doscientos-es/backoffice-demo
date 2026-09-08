import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import { createSubscription } from '../actions'
import { SubscriptionFormFields } from '../subscription-form-fields'

export const metadata: Metadata = { title: 'Nueva suscripción · doscientos' }

export default async function NewSubscriptionPage() {
  const user = await requireUser()
  if (user.role === 'viewer') redirect('/subscriptions')

  const supabase = await createServerClient()
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/subscriptions" label="Suscripciones" />
        <PageHeader
          title="Nueva suscripción"
          description="Define un servicio recurrente vinculado a un cliente."
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            action={async (fd) => {
              'use server'
              const res = await createSubscription(fd)
              if (res.ok) redirect('/subscriptions')
            }}
            className="flex flex-col gap-6"
          >
            <SubscriptionFormFields
              clients={(clients ?? []) as { id: string; name: string }[]}
              projects={(projects ?? []) as { id: string; name: string }[]}
            />

            <div className="flex justify-end">
              <SubmitButton>Crear suscripción</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
