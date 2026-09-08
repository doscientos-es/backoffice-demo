import { ArrowRight, Download } from 'lucide-react'
import type { ReactNode } from 'react'

import { LogoMark } from '@/components/branding'
import { Markdown } from '@/components/ui/markdown'
import {
  BILLING_CYCLE_LABELS,
  type BillingCycle,
  computeProposalTotals,
  type ProposalTotals,
} from '@/lib/finance'
import type { KeyPoint } from '@/lib/proposals/key-points'
import {
  PAYMENT_SCHEDULE_LABELS,
  type ScopeModule,
  scopeModuleDurationText,
} from '@/lib/proposals/scope'
import { formatDate, formatEUR } from '@/lib/utils'

import type { DeckProposal, DeckProposalItem, DeckTeamMember } from './page'

function buildTotals(items: DeckProposalItem[]): ProposalTotals {
  return computeProposalTotals(
    items.map((it) => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
      billing_cycle: it.billing_cycle ?? 'none',
    })),
  )
}

function hasRecurring(totals: ProposalTotals): boolean {
  return totals.monthly.total > 0 || totals.quarterly.total > 0 || totals.yearly.total > 0
}

export type DeckSlide = {
  key: string
  label: string
  accent: 'green' | 'white' | 'zinc'
  element: ReactNode
}

function SlideWrapper({ children, watermark }: { children: ReactNode; watermark?: string }) {
  if (!watermark) return <>{children}</>
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'contents' }}>
      {children}
      <div className="deck-watermark" aria-hidden>
        {watermark}
      </div>
    </div>
  )
}

function Stagger({
  i,
  children,
  className,
}: {
  i: number
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`deck-stagger ${className ?? ''}`} style={{ ['--i' as string]: i }}>
      {children}
    </div>
  )
}

function CoverSlide({ proposal }: { proposal: DeckProposal }) {
  return (
    <div className="deck-slide bg-[#2A4227] p-6 text-center text-white sm:p-10 md:p-16 lg:p-24">
      <Stagger i={0}>
        <LogoMark size={56} variant="brand" className="mb-8 opacity-80 sm:mb-12 sm:size-[72px]" />
      </Stagger>
      <Stagger i={1}>
        <p className="mb-4 text-[10px] font-semibold tracking-[0.25em] text-white/50 uppercase sm:mb-6 sm:text-xs sm:tracking-[0.3em]">
          Propuesta {proposal.number}
        </p>
      </Stagger>
      <Stagger i={2}>
        <h1 className="mb-6 max-w-4xl text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:mb-8 sm:text-5xl md:text-6xl lg:text-7xl">
          {proposal.title}
        </h1>
      </Stagger>
      {proposal.client_name && (
        <Stagger i={3}>
          <div className="flex flex-col items-center gap-3">
            {proposal.client_logo_url && (
              // biome-ignore lint/performance/noImgElement: URL externa del logo del cliente, no compatible con next/image
              <img
                src={proposal.client_logo_url}
                alt={`Logo ${proposal.client_name}`}
                className="h-10 max-w-[160px] object-contain opacity-80 brightness-0 invert sm:h-14"
              />
            )}
            <p className="px-2 text-base font-light text-white/70 sm:text-xl md:text-2xl">
              Preparado para <span className="font-medium text-white">{proposal.client_name}</span>
            </p>
          </div>
        </Stagger>
      )}
      {proposal.valid_until && (
        <Stagger i={4}>
          <p className="mt-4 text-xs tracking-widest text-white/40 uppercase sm:mt-6 sm:text-sm">
            Válida hasta {formatDate(proposal.valid_until)}
          </p>
        </Stagger>
      )}
    </div>
  )
}

function SectionSlide({
  label,
  title,
  children,
  accent = 'white',
}: {
  label: string
  title: string
  children: ReactNode
  accent?: 'white' | 'zinc'
}) {
  const bg = accent === 'zinc' ? 'bg-zinc-50' : 'bg-white'
  return (
    <div className={`deck-slide justify-center p-6 text-zinc-900 sm:p-10 md:p-16 lg:p-24 ${bg}`}>
      <Stagger i={0}>
        <p className="mb-3 text-[10px] font-semibold tracking-[0.25em] text-[#2A4227] uppercase sm:mb-4 sm:text-xs sm:tracking-[0.3em]">
          {label}
        </p>
      </Stagger>
      <Stagger i={1}>
        <h2 className="mb-8 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-balance sm:mb-12 sm:text-4xl md:text-5xl lg:text-6xl">
          {title}
        </h2>
      </Stagger>
      <Stagger i={2} className="flex w-full flex-col items-center">
        {children}
      </Stagger>
    </div>
  )
}

function ContextSlide({ proposal }: { proposal: DeckProposal }) {
  return (
    <SectionSlide label="Contexto" title="Dónde estamos hoy">
      <div className="w-full max-w-3xl text-left">
        <Markdown
          source={proposal.context_markdown ?? ''}
          className="deck-markdown deck-markdown-intro text-base text-zinc-700 sm:text-lg md:text-xl"
        />
      </div>
    </SectionSlide>
  )
}

/**
 * Shared list slide used for problems and solutions. Both blocks share the
 * same layout but differ in badge palette so consecutive slides feel
 * distinct: muted neutral for problems (something we observed), brand
 * green for solutions (something we do about it).
 */
function KeyPointsListSlide({
  label,
  title,
  items,
  accent,
  badgeVariant,
}: {
  label: string
  title: string
  items: KeyPoint[]
  accent?: 'white' | 'zinc'
  badgeVariant: 'muted' | 'brand'
}) {
  const badgeClass =
    badgeVariant === 'brand' ? 'bg-[#2A4227] text-white' : 'bg-zinc-200 text-zinc-700'
  return (
    <SectionSlide label={label} title={title} accent={accent}>
      <ul className="flex w-full max-w-3xl flex-col gap-4 text-left sm:gap-6">
        {items.map((kp, i) => (
          <li
            key={kp.id}
            className="deck-stagger flex items-start gap-4 sm:gap-5"
            style={{ ['--i' as string]: 3 + i }}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums sm:h-10 sm:w-10 sm:text-sm ${badgeClass}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 pt-1 sm:pt-1.5">
              <p className="text-base font-semibold text-balance text-zinc-900 sm:text-lg md:text-xl">
                {kp.title}
              </p>
              {kp.description ? (
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-zinc-500 sm:mt-1.5 sm:text-base">
                  {kp.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SectionSlide>
  )
}

function CadenceBadge({ cycle }: { cycle: BillingCycle }) {
  if (cycle === 'none') return null
  return (
    <span className="inline-flex items-center rounded-full bg-[#2A4227]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#2A4227] uppercase sm:text-xs">
      {BILLING_CYCLE_LABELS[cycle]}
    </span>
  )
}

function ServicesSlide({ items }: { items: DeckProposalItem[] }) {
  return (
    <SectionSlide label="Servicios" title="Qué ofrecemos" accent="zinc">
      <ul className="flex w-full max-w-3xl flex-col gap-4 text-left sm:gap-6">
        {items.map((item, i) => {
          const cycle: BillingCycle = item.billing_cycle ?? 'none'
          return (
            <li
              key={item.id}
              className="deck-stagger flex items-start gap-4 sm:gap-5"
              style={{ ['--i' as string]: 3 + i }}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2A4227] text-xs font-bold text-white tabular-nums sm:h-10 sm:w-10 sm:text-sm">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 pt-1 sm:pt-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-balance text-zinc-900 sm:text-lg md:text-xl">
                    {item.description}
                  </p>
                  <CadenceBadge cycle={cycle} />
                </div>
                {item.quantity !== 1 && (
                  <p className="mt-0.5 text-xs text-zinc-500 sm:mt-1 sm:text-sm">
                    {item.quantity} unidades
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </SectionSlide>
  )
}

function ScopeModuleSlide({ module, index }: { module: ScopeModule; index: number }) {
  return (
    <SectionSlide
      label={`Alcance · ${String(index + 1).padStart(2, '0')}`}
      title={module.title}
      accent="zinc"
    >
      <div className="w-full max-w-3xl text-left">
        {module.description ? (
          <p className="mb-6 text-base leading-relaxed text-zinc-600 sm:text-lg">
            {module.description}
          </p>
        ) : null}
        {scopeModuleDurationText(module) ? (
          <p className="mb-6 text-sm font-medium text-zinc-500">
            Plazo estimado: {scopeModuleDurationText(module)}
          </p>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2">
          {module.included.length > 0 ? (
            <ScopeList title="Incluido" items={module.included} tone="included" />
          ) : null}
          {module.excluded.length > 0 ? (
            <ScopeList title="No incluido" items={module.excluded} tone="excluded" />
          ) : null}
        </div>
        {module.notes ? (
          <p className="mt-6 border-t border-zinc-200 pt-4 text-sm leading-relaxed text-zinc-500">
            <strong>Notas:</strong> {module.notes}
          </p>
        ) : null}
      </div>
    </SectionSlide>
  )
}

function ScopeList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'included' | 'excluded'
}) {
  return (
    <div>
      <p
        className={`mb-3 text-xs font-semibold tracking-[0.2em] uppercase ${tone === 'included' ? 'text-[#2A4227]' : 'text-zinc-500'}`}
      >
        {title}
      </p>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-zinc-700 sm:text-base">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DeliverySlide({ proposal }: { proposal: DeckProposal }) {
  const deliverables = proposal.deliverables?.trim()
  const acceptanceCriteria = proposal.acceptance_criteria?.trim()
  return (
    <SectionSlide label="Entrega" title="Cómo validaremos el proyecto">
      <div className="grid max-w-3xl gap-8 text-left sm:grid-cols-2">
        {deliverables ? (
          <div>
            <p className="mb-3 text-sm font-semibold text-zinc-900">Entregables</p>
            <Markdown source={deliverables} className="deck-markdown text-sm text-zinc-600" />
          </div>
        ) : null}
        {acceptanceCriteria ? (
          <div>
            <p className="mb-3 text-sm font-semibold text-zinc-900">Criterios de aceptación</p>
            <Markdown source={acceptanceCriteria} className="deck-markdown text-sm text-zinc-600" />
          </div>
        ) : null}
      </div>
    </SectionSlide>
  )
}

function PricingTotals({ totals }: { totals: ProposalTotals }) {
  const recurring = hasRecurring(totals)
  return (
    <div className="flex w-full flex-col items-end gap-3">
      <div className="flex flex-col items-end gap-2">
        {recurring ? (
          <p className="text-[10px] font-semibold tracking-[0.25em] text-zinc-400 uppercase sm:text-xs">
            Inversión inicial
          </p>
        ) : null}
        <div className="flex gap-6 text-xs text-zinc-500 sm:gap-12 sm:text-sm">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.subtotal)}</span>
        </div>
        <div className="flex gap-6 text-xs text-zinc-500 sm:gap-12 sm:text-sm">
          <span>IVA</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.taxAmount)}</span>
        </div>
        <div className="mt-2 flex gap-6 border-t-2 border-zinc-300 pt-3 text-xl font-bold text-zinc-900 sm:gap-12 sm:text-2xl md:text-3xl">
          <span>Total</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.total)}</span>
        </div>
      </div>

      {recurring ? (
        <div className="flex w-full flex-col items-end gap-2 border-t border-zinc-200 pt-4">
          <p className="text-[10px] font-semibold tracking-[0.25em] text-[#2A4227] uppercase sm:text-xs">
            Mantenimiento recurrente
          </p>
          {totals.monthly.total > 0 ? (
            <div className="flex gap-6 text-sm text-zinc-700 sm:gap-12 sm:text-base">
              <span>Mensual</span>
              <span className="font-semibold tabular-nums">{formatEUR(totals.monthly.total)}</span>
            </div>
          ) : null}
          {totals.quarterly.total > 0 ? (
            <div className="flex gap-6 text-sm text-zinc-700 sm:gap-12 sm:text-base">
              <span>Trimestral</span>
              <span className="font-semibold tabular-nums">
                {formatEUR(totals.quarterly.total)}
              </span>
            </div>
          ) : null}
          {totals.yearly.total > 0 ? (
            <div className="flex gap-6 text-sm text-zinc-700 sm:gap-12 sm:text-base">
              <span>Anual</span>
              <span className="font-semibold tabular-nums">{formatEUR(totals.yearly.total)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PricingSlide({ items }: { proposal: DeckProposal; items: DeckProposalItem[] }) {
  const totals = buildTotals(items)
  return (
    <SectionSlide label="Inversión" title="Detalle económico">
      <div className="w-full max-w-3xl">
        <table className="mb-6 w-full text-left text-xs sm:mb-8 sm:text-sm md:text-base">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="py-2 text-left text-[10px] font-medium tracking-wider text-zinc-500 uppercase sm:py-3 sm:text-xs">
                Descripción
              </th>
              <th className="hidden py-3 text-right text-xs font-medium tracking-wider text-zinc-500 uppercase sm:table-cell">
                Cant.
              </th>
              <th className="hidden py-3 text-right text-xs font-medium tracking-wider text-zinc-500 uppercase sm:table-cell">
                Precio
              </th>
              <th className="py-2 text-right text-[10px] font-medium tracking-wider text-zinc-500 uppercase sm:py-3 sm:text-xs">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cycle: BillingCycle = item.billing_cycle ?? 'none'
              return (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50"
                >
                  <td className="py-3 pr-3 text-zinc-800 sm:py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.description}</span>
                      <CadenceBadge cycle={cycle} />
                    </div>
                    <span className="mt-0.5 block text-[11px] text-zinc-500 tabular-nums sm:hidden">
                      {item.quantity} × {formatEUR(item.unit_price)}
                    </span>
                  </td>
                  <td className="hidden py-4 text-right text-zinc-500 tabular-nums sm:table-cell">
                    {item.quantity}
                  </td>
                  <td className="hidden py-4 text-right text-zinc-500 tabular-nums sm:table-cell">
                    {formatEUR(item.unit_price)}
                  </td>
                  <td className="py-3 text-right font-medium whitespace-nowrap tabular-nums sm:py-4">
                    {formatEUR(item.subtotal)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <PricingTotals totals={totals} />
      </div>
    </SectionSlide>
  )
}

function TeamSlide({ team }: { team: DeckTeamMember[] }) {
  return (
    <SectionSlide label="El equipo" title="Quién trabajará en tu proyecto">
      <div className="flex max-w-3xl flex-wrap justify-center gap-6 sm:gap-10">
        {team.map((member, i) => (
          <div
            key={member.id}
            className="deck-stagger flex flex-col items-center gap-2 sm:gap-3"
            style={{ ['--i' as string]: 3 + i }}
          >
            <div className="size-16 overflow-hidden rounded-full bg-zinc-200 ring-2 ring-[#2A4227]/10 sm:h-20 sm:w-20">
              {member.avatar_url ? (
                // biome-ignore lint/performance/noImgElement: URL externa de avatar, no compatible con next/image
                <img
                  src={member.avatar_url}
                  alt={member.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#2A4227] text-xl font-bold text-white sm:text-2xl">
                  {member.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-zinc-900 sm:text-sm">{member.name}</p>
              {member.job_title && (
                <p className="mt-0.5 text-[11px] text-zinc-500 sm:text-xs">{member.job_title}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionSlide>
  )
}

function PricingBarChart({ items }: { proposal: DeckProposal; items: DeckProposalItem[] }) {
  const maxVal = Math.max(...items.map((i) => i.subtotal), 1)
  const totals = buildTotals(items)
  return (
    <SectionSlide label="Inversión" title="Detalle económico">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:gap-5">
          {items.map((item, i) => {
            const cycle: BillingCycle = item.billing_cycle ?? 'none'
            return (
              <div key={item.id} className="deck-stagger" style={{ ['--i' as string]: 3 + i }}>
                <div className="mb-1.5 flex justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-left text-xs text-zinc-700 sm:text-sm">
                      {item.description}
                    </span>
                    <CadenceBadge cycle={cycle} />
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap text-zinc-900 tabular-nums sm:text-sm">
                    {formatEUR(item.subtotal)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 sm:h-2">
                  <div
                    className="h-full rounded-full bg-[#2A4227]"
                    style={{ width: `${(item.subtotal / maxVal) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="border-t border-zinc-200 pt-4">
          <PricingTotals totals={totals} />
        </div>
      </div>
    </SectionSlide>
  )
}

function TermsSlide({ proposal }: { proposal: DeckProposal }) {
  return (
    <SectionSlide label="Condiciones" title="Términos del acuerdo" accent="zinc">
      <div className="w-full max-w-3xl text-left">
        {proposal.payment_terms ? (
          <div className="mb-6">
            <p className="text-sm font-semibold text-zinc-900">Forma de pago</p>
            <p className="mt-1 text-xs font-semibold tracking-wider text-[#2A4227] uppercase">
              {PAYMENT_SCHEDULE_LABELS[proposal.payment_schedule]}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{proposal.payment_terms}</p>
          </div>
        ) : null}
        {proposal.change_management_terms ? (
          <div className="mb-6">
            <p className="text-sm font-semibold text-zinc-900">Cambios de alcance</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {proposal.change_management_terms}
            </p>
          </div>
        ) : null}
        <Markdown
          source={proposal.terms ?? ''}
          className="deck-markdown deck-markdown-terms text-sm text-zinc-600 sm:text-base"
        />
      </div>
    </SectionSlide>
  )
}

function ClosingSlide({ proposal, token }: { proposal: DeckProposal; token: string }) {
  return (
    <div className="deck-slide bg-[#2A4227] p-6 text-center text-white sm:p-10 md:p-16 lg:p-24">
      <Stagger i={0}>
        <LogoMark size={48} variant="brand" className="mb-8 opacity-60 sm:mb-12 sm:size-[56px]" />
      </Stagger>
      <Stagger i={1}>
        <h2 className="mb-4 text-4xl font-bold tracking-tight sm:mb-6 sm:text-5xl md:text-6xl lg:text-7xl">
          ¿Hablamos?
        </h2>
      </Stagger>
      <Stagger i={2}>
        <p className="mb-8 max-w-xl px-2 text-base leading-relaxed font-light text-white/60 sm:mb-12 sm:text-lg md:text-xl">
          Estamos listos para empezar. Cuando confirmes, arrancamos.
        </p>
      </Stagger>
      <Stagger i={3}>
        <div className="flex flex-col items-center gap-3">
          <a
            href={`/p/proposal/${token}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2A4227] shadow-lg transition-all hover:gap-4 hover:bg-white/90 sm:gap-3 sm:px-8 sm:py-4 sm:text-base"
          >
            Ver propuesta y aceptar
            <ArrowRight className="size-4 sm:size-5" />
          </a>
          <a
            href={`/p/proposal/${token}/pdf`}
            className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-2.5 text-xs font-semibold text-white/90 transition-colors hover:border-white hover:bg-white/10"
          >
            <Download className="size-3.5" />
            Descargar propuesta en PDF
          </a>
        </div>
      </Stagger>
      {proposal.client_name && (
        <Stagger i={4}>
          <p className="mt-10 text-[10px] tracking-[0.25em] text-white/40 uppercase sm:mt-16 sm:text-xs sm:tracking-[0.3em]">
            {proposal.client_name}
          </p>
        </Stagger>
      )}
    </div>
  )
}

export function buildSlides(
  proposal: DeckProposal,
  items: DeckProposalItem[],
  token: string,
  team: DeckTeamMember[] = [],
  watermark?: string,
): DeckSlide[] {
  const wm = (el: ReactNode): ReactNode =>
    watermark ? <SlideWrapper watermark={watermark}>{el}</SlideWrapper> : el

  const slides: DeckSlide[] = []
  slides.push({
    key: 'cover',
    label: 'Portada',
    accent: 'green',
    element: wm(<CoverSlide proposal={proposal} />),
  })
  // Narrative (Context → Problems → Solutions) always lands before the
  // price so the client reads the framing first. Each block only renders
  // if it has content, so an empty proposal still flows naturally.
  if (proposal.context_markdown?.trim()) {
    slides.push({
      key: 'context',
      label: 'Contexto',
      accent: 'white',
      element: wm(<ContextSlide proposal={proposal} />),
    })
  }
  if (proposal.problems.length > 0) {
    slides.push({
      key: 'problems',
      label: 'Retos',
      accent: 'zinc',
      element: wm(
        <KeyPointsListSlide
          label="Retos detectados"
          title="Lo que queremos resolver"
          items={proposal.problems}
          accent="zinc"
          badgeVariant="muted"
        />,
      ),
    })
  }
  if (proposal.solutions.length > 0) {
    slides.push({
      key: 'solutions',
      label: 'Solución',
      accent: 'white',
      element: wm(
        <KeyPointsListSlide
          label="Nuestra propuesta"
          title="Cómo lo abordamos"
          items={proposal.solutions}
          accent="white"
          badgeVariant="brand"
        />,
      ),
    })
  }
  proposal.scope_modules.forEach((module, index) => {
    slides.push({
      key: `scope-${module.id}`,
      label: `Módulo ${index + 1}`,
      accent: 'zinc',
      element: wm(<ScopeModuleSlide module={module} index={index} />),
    })
  })
  if (proposal.deliverables?.trim() || proposal.acceptance_criteria?.trim()) {
    slides.push({
      key: 'delivery',
      label: 'Entrega',
      accent: 'white',
      element: wm(<DeliverySlide proposal={proposal} />),
    })
  }
  if (team.length > 0) {
    slides.push({
      key: 'team',
      label: 'Equipo',
      accent: 'white',
      element: wm(<TeamSlide team={team} />),
    })
  }
  if (items.length > 0) {
    slides.push({
      key: 'services',
      label: 'Servicios',
      accent: 'zinc',
      element: wm(<ServicesSlide items={items} />),
    })
    const pricing =
      items.length > 3 ? (
        <PricingBarChart proposal={proposal} items={items} />
      ) : (
        <PricingSlide proposal={proposal} items={items} />
      )
    slides.push({ key: 'pricing', label: 'Inversión', accent: 'white', element: wm(pricing) })
  }
  if (proposal.payment_terms || proposal.change_management_terms || proposal.terms) {
    slides.push({
      key: 'terms',
      label: 'Condiciones',
      accent: 'zinc',
      element: wm(<TermsSlide proposal={proposal} />),
    })
  }
  slides.push({
    key: 'closing',
    label: 'Cierre',
    accent: 'green',
    element: wm(<ClosingSlide proposal={proposal} token={token} />),
  })
  return slides
}
