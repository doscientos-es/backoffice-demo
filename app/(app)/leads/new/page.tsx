import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'

import type { LeadFormDefaults } from '../lead-form-fields'
import { LeadNewForm } from './lead-new-form'

export const metadata: Metadata = { title: 'Nuevo lead · doscientos' }

type PageProps = {
  searchParams: Promise<{
    shared_text?: string | string[]
    shared_title?: string | string[]
    shared_url?: string | string[]
  }>
}

function first(value: string | string[] | undefined, maxLength: number): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, maxLength) ?? ''
}

export default async function NewLeadPage({ searchParams }: PageProps) {
  await requireUser()
  const params = await searchParams
  const sharedTitle = first(params.shared_title, 160)
  const sharedText = first(params.shared_text, 3000)
  const sharedUrl = first(params.shared_url, 1000)
  const sharedNotes = [sharedText, sharedUrl].filter(Boolean).join('\n')
  const defaults: LeadFormDefaults | undefined =
    sharedTitle || sharedNotes
      ? { name: sharedTitle, notes: sharedNotes, source: 'Otro' }
      : undefined
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo lead"
        description="Registra una nueva oportunidad comercial."
        back={<BackLink href="/leads" label="Volver a leads" />}
      />

      <Card>
        <CardContent className="pt-6">
          <LeadNewForm defaults={defaults} shared={Boolean(defaults)} />
        </CardContent>
      </Card>
    </div>
  )
}
