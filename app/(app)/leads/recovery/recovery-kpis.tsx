import { HandHeart as HeartHandshake, Mail as MailX, TriangleAlert, Users } from 'lucide-react'

import { StatCard } from '@/components/layout/stat-card'
import type { RecoveryKpis as RecoveryKpisData } from '@/lib/recovery/types'
import { formatEUR } from '@/lib/utils'

/**
 * Funnel snapshot for the recovery hub. Reuses the shared `StatCard` primitive
 * so KPI styling stays consistent with the rest of the app. Pure presentation:
 * receives already-aggregated `RecoveryKpis` and renders a responsive grid.
 */
export function RecoveryKpis({ kpis }: { kpis: RecoveryKpisData }) {
  const contacted = kpis.byState.contacted + kpis.byState.opened + kpis.byState.engaged

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Leads perdidos"
        value={kpis.total}
        icon={Users}
        hint="Perdidos y no interesados"
      />
      <StatCard
        label="Sin contactar"
        value={kpis.byState.pending}
        icon={MailX}
        tone="warning"
        hint={`${contacted} ya contactados`}
      />
      <StatCard
        label="Interesados"
        value={kpis.byState.engaged}
        icon={HeartHandshake}
        tone="success"
        hint="Abrieron, clicaron o respondieron"
      />
      <StatCard
        label="Valor en riesgo"
        value={formatEUR(kpis.valueAtRisk)}
        icon={TriangleAlert}
        tone="danger"
        hint="Suma de valor estimado"
      />
    </div>
  )
}
