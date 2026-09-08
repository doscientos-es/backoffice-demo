import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'

import {
  AccountsReceivableSkeleton,
  AccountsReceivableWidget,
} from '@/components/finance/accounts-receivable-card'
import {
  MonthExpensesSkeleton,
  MonthExpensesWidget,
} from '@/components/finance/month-expenses-card'
import { SectionBoundary } from '@/components/ui/error-boundary'
import { canViewFinance, requireUser } from '@/lib/auth'
import { getGreeting, parseDashboardRange } from '@/lib/utils/date'

import { AvisosWidget } from './_components/avisos-widget'
import { KpiGrid } from './_components/kpi-grid'
import { MoneyOpportunitiesWidget } from './_components/money-opportunities-widget'
import { MyDayWidget } from './_components/my-day-widget'
import { RangeSelector } from './_components/range-selector'
import { RevenueWidget } from './_components/revenue-widget'
import {
  AvisosWidgetSkeleton,
  KpiGridSkeleton,
  MoneyOpportunitiesWidgetSkeleton,
  MyDayWidgetSkeleton,
  RangeSelectorSkeleton,
  RevenueWidgetSkeleton,
} from './_components/widget-skeletons'

export const metadata: Metadata = { title: 'Inicio · doscientos' }
export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ range?: string | string[]; member?: string | string[] }>
}

export default async function InicioPage({ searchParams }: PageProps) {
  const [user, params] = await Promise.all([requireUser(), searchParams])
  const range = parseDashboardRange(params.range)
  const greeting = getGreeting()
  const firstName = user.name.split(' ')[0]
  const showFinance = canViewFinance(user.role)
  const today = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="flex flex-col gap-10 pb-4">
      <header className="relative overflow-hidden">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {greeting}, {firstName}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
              Empieza por lo urgente y mantén el pulso del negocio en una sola vista.
            </p>
          </div>
          <div className="border-border/70 bg-background/70 text-muted-foreground inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm">
            <CalendarDays aria-hidden="true" className="text-primary size-3.5" />
            <span className="capitalize">{today}</span>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-5" aria-labelledby="inicio-prioridades">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="inicio-prioridades" className="mt-1 text-xl font-semibold tracking-tight">
              Prioridades para avanzar
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Tareas, conversaciones y avisos que no conviene dejar pasar.
            </p>
          </div>
        </div>

        <SectionBoundary pending={<MyDayWidgetSkeleton />} label="No se pudo cargar tu día">
          <MyDayWidget member={params.member} />
        </SectionBoundary>
        <SectionBoundary
          pending={<AvisosWidgetSkeleton />}
          label="No se pudieron cargar los avisos"
        >
          <AvisosWidget showFinance={showFinance} />
        </SectionBoundary>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="inicio-oportunidades">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-emerald-600 uppercase dark:text-emerald-400">
            Crecimiento
          </p>
          <h2 id="inicio-oportunidades" className="mt-1 text-xl font-semibold tracking-tight">
            Oportunidades que merecen seguimiento
          </h2>
        </div>
        <SectionBoundary
          pending={<MoneyOpportunitiesWidgetSkeleton />}
          label="No se pudieron cargar las oportunidades"
        >
          <MoneyOpportunitiesWidget />
        </SectionBoundary>
      </section>

      <section
        className="border-border bg-muted/30 relative overflow-hidden rounded-2xl border p-4 sm:p-5 md:p-6"
        aria-labelledby="inicio-negocio"
      >
        <div className="bg-primary/8 pointer-events-none absolute -top-24 -right-20 size-64 rounded-full blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                Visión general
              </p>
              <h2 id="inicio-negocio" className="mt-1 text-xl font-semibold tracking-tight">
                La salud del negocio
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Una lectura clara de la actividad comercial y financiera.
              </p>
            </div>
            <SectionBoundary
              pending={<RangeSelectorSkeleton />}
              label="No se pudo cargar el selector"
            >
              <RangeSelector current={range} />
            </SectionBoundary>
          </div>

          <SectionBoundary
            key={range}
            pending={<KpiGridSkeleton />}
            label="No se pudieron cargar los KPIs"
          >
            <KpiGrid range={range} showFinance={showFinance} />
          </SectionBoundary>

          {showFinance ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionBoundary
                  pending={<AccountsReceivableSkeleton />}
                  label="No se pudo cargar el cobro pendiente"
                >
                  <AccountsReceivableWidget />
                </SectionBoundary>
                <SectionBoundary
                  pending={<MonthExpensesSkeleton />}
                  label="No se pudo cargar el gasto del mes"
                >
                  <MonthExpensesWidget />
                </SectionBoundary>
              </div>

              <SectionBoundary
                pending={<RevenueWidgetSkeleton />}
                label="No se pudieron cargar los ingresos"
              >
                <RevenueWidget />
              </SectionBoundary>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}
