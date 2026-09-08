import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePageRole } from '@/lib/auth'
import { getCompanyGoals } from '@/lib/dashboard/queries'

import { GoalsForm } from './goals-form'

export const metadata: Metadata = { title: 'Metas · Ajustes · doscientos' }
export const dynamic = 'force-dynamic'

export default async function GoalsSettingsPage() {
  await requirePageRole(['owner', 'admin'])
  const goals = await getCompanyGoals()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Metas"
        description="Objetivos mensuales de empresa que se muestran como progreso en el dashboard."
      />
      <Card>
        <CardContent className="pt-6">
          <GoalsForm goals={goals} />
        </CardContent>
      </Card>
    </div>
  )
}
