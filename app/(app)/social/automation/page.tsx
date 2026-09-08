import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { requireUser } from '@/lib/auth'
import { listAutomationRules } from '@/lib/social/repo'

import { AutomationManager } from './_components/automation-manager'

export const metadata: Metadata = { title: 'Automatizaciones · Social · doscientos' }
export const dynamic = 'force-dynamic'

export default async function SocialAutomationPage() {
  await requireUser()
  const rules = await listAutomationRules()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Automatizaciones"
        description="Responde a comentarios de Instagram y Facebook cuando alguien use una palabra clave."
        back={<BackLink href="/social" label="Volver a Social" />}
      />
      <AutomationManager initialRules={rules} />
    </div>
  )
}
