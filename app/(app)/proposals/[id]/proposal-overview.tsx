import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import type { PaymentPlanItem, ScopeModule } from '@/lib/proposals/scope'
import { formatDate, formatEUR } from '@/lib/utils'

type Item = {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  subtotal: number
  billing_cycle: string | null
}

type TeamMember = { id: string; name: string; job_title: string | null }

type Props = {
  total: number
  validUntil: string | null
  paymentPlan: PaymentPlanItem[]
  paymentTerms: string | null
  items: Item[]
  scopeModules: ScopeModule[]
  deliverables: string | null
  acceptanceCriteria: string | null
  notes: string | null
  team: TeamMember[]
}

/** Read-only, scannable proposal view; actions intentionally live outside it. */
export function ProposalOverview({
  total,
  validUntil,
  paymentPlan,
  paymentTerms,
  items,
  scopeModules,
  deliverables,
  acceptanceCriteria,
  notes,
  team,
}: Props) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.8fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inversión y condiciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-muted/40 rounded-lg p-4">
                <p className="text-muted-foreground text-xs">Inversión inicial · IVA incluido</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatEUR(total)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-4">
                <p className="text-muted-foreground text-xs">Válida hasta</p>
                <p className="mt-1 text-lg font-semibold">{formatDate(validUntil)}</p>
              </div>
            </div>
            {paymentPlan.length > 0 ? (
              <ul className="border-border divide-y rounded-lg border text-sm">
                {paymentPlan.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span>{item.title}</span>
                    <span className="text-right font-medium tabular-nums">
                      {item.percentage} % · {formatEUR((total * item.percentage) / 100)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {paymentTerms ? <Markdown source={paymentTerms} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Partidas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border divide-y text-sm">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-6 py-3">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.quantity} × {formatEUR(item.unit_price)} · IVA {item.vat_rate} %
                      {item.billing_cycle && item.billing_cycle !== 'none'
                        ? ` · ${item.billing_cycle}`
                        : ''}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums">{formatEUR(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {scopeModules.length > 0 || deliverables || acceptanceCriteria || notes ? (
          <Card>
            <CardHeader>
              <CardTitle>Alcance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {scopeModules.map((module) => (
                <div key={module.id} className="border-border rounded-lg border p-3">
                  <p className="font-medium">{module.title}</p>
                  {module.description ? (
                    <p className="text-muted-foreground mt-1 text-sm">{module.description}</p>
                  ) : null}
                </div>
              ))}
              {deliverables ? <Markdown source={deliverables} /> : null}
              {acceptanceCriteria ? <Markdown source={acceptanceCriteria} /> : null}
              {notes ? <Markdown source={notes} /> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Equipo del proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          {team.length > 0 ? (
            <ul className="flex flex-col gap-3 text-sm">
              {team.map((member) => (
                <li key={member.id}>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-muted-foreground">{member.job_title ?? 'Equipo Doscientos'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Aún no hay personas asignadas.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
