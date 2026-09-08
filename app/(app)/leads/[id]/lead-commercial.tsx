import { BriefcaseBusiness, FileText, ReceiptText } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { LeadRelatedInvoice, LeadRelatedProject, LeadRelatedProposal } from '@/lib/leads/types'
import {
  INVOICE_STATUS,
  type InvoiceStatus,
  PROJECT_STATUS,
  PROPOSAL_STATUS,
  type ProjectStatus,
  type ProposalStatus,
} from '@/lib/status'
import { formatEUR } from '@/lib/utils'

import { LeadDetailDisclosure } from './lead-detail-disclosure'

type LeadCommercialProps = {
  leadId: string
  linkedClientId: string | null
  proposals: LeadRelatedProposal[]
  projects: LeadRelatedProject[]
  invoices: LeadRelatedInvoice[]
}

/** Shown in place of a list when projects/invoices require a client. */
function ClientRequiredHint() {
  return (
    <p className="text-muted-foreground px-6 py-2 text-sm">
      Disponible cuando el lead sea cliente.
    </p>
  )
}

function EmptyHint({ label }: { label: string }) {
  return <p className="text-muted-foreground px-6 py-2 text-sm">{label}</p>
}

function relationshipSummary(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function MobileRelationshipRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </dt>
      <dd className="flex min-w-0 flex-col gap-1.5">{children}</dd>
    </div>
  )
}

function MobileEmptyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-primary text-xs font-medium hover:underline">
      {children}
    </Link>
  )
}

/**
 * Commercial pipeline shortcuts for a lead: proposals (lead-first, no NIF
 * required), plus projects and invoices that only exist once the lead is
 * converted into a client.
 */
export function LeadCommercial({
  leadId,
  linkedClientId,
  proposals,
  projects,
  invoices,
}: LeadCommercialProps) {
  return (
    <>
      <section className="lg:hidden" aria-label="Relaciones comerciales">
        <LeadDetailDisclosure
          id="commercial-records"
          title="Relaciones comerciales"
          description={[
            relationshipSummary(proposals.length, 'propuesta', 'propuestas'),
            relationshipSummary(projects.length, 'proyecto', 'proyectos'),
            relationshipSummary(invoices.length, 'factura', 'facturas'),
          ].join(' · ')}
          contentClassName="py-4"
        >
          <dl className="flex flex-col gap-4">
            <MobileRelationshipRow icon={<FileText className="size-3.5" />} label="Propuestas">
              {proposals.length === 0 ? (
                <MobileEmptyLink href={`/proposals/new?lead_id=${leadId}`}>
                  Crear propuesta
                </MobileEmptyLink>
              ) : (
                proposals.map((proposal) => (
                  <Link
                    key={proposal.id}
                    href={`/proposals/${proposal.id}`}
                    className="hover:bg-muted flex min-w-0 items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs transition-colors"
                  >
                    <span className="truncate font-medium">
                      {proposal.number ?? proposal.title ?? 'Propuesta'}
                    </span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {formatEUR(Number(proposal.total ?? 0))}
                    </span>
                  </Link>
                ))
              )}
            </MobileRelationshipRow>

            <MobileRelationshipRow
              icon={<BriefcaseBusiness className="size-3.5" />}
              label="Proyectos"
            >
              {!linkedClientId ? (
                <span className="text-muted-foreground text-xs">Cuando sea cliente</span>
              ) : projects.length === 0 ? (
                <MobileEmptyLink href={`/projects/new?client_id=${linkedClientId}`}>
                  Crear proyecto
                </MobileEmptyLink>
              ) : (
                projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="hover:bg-muted flex min-w-0 items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs transition-colors"
                  >
                    <span className="truncate font-medium">{project.name}</span>
                    <StatusBadge meta={PROJECT_STATUS} value={project.status as ProjectStatus} />
                  </Link>
                ))
              )}
            </MobileRelationshipRow>

            <MobileRelationshipRow icon={<ReceiptText className="size-3.5" />} label="Facturas">
              {!linkedClientId ? (
                <span className="text-muted-foreground text-xs">Cuando sea cliente</span>
              ) : invoices.length === 0 ? (
                <span className="text-muted-foreground text-xs">Sin facturas</span>
              ) : (
                invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="hover:bg-muted flex min-w-0 items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs transition-colors"
                  >
                    <span className="truncate font-medium">{invoice.full_number ?? 'Factura'}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge meta={INVOICE_STATUS} value={invoice.status as InvoiceStatus} />
                      <span className="text-muted-foreground tabular-nums">
                        {formatEUR(Number(invoice.total ?? 0))}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </MobileRelationshipRow>
          </dl>
        </LeadDetailDisclosure>
      </section>

      <div className="hidden gap-6 lg:grid lg:grid-cols-3">
        {/* Proposals — always available via the lead-first flow. */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Propuestas</CardTitle>
            <Button asChild size="sm">
              <Link href={`/proposals/new?lead_id=${leadId}`}>Nueva</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {proposals.length === 0 ? (
              <EmptyHint label="Sin propuestas." />
            ) : (
              <ul className="divide-border divide-y">
                {proposals.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/proposals/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.number ?? p.title ?? 'Propuesta'}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge meta={PROPOSAL_STATUS} value={p.status as ProposalStatus} />
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatEUR(Number(p.total ?? 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Projects — require a linked client. */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Proyectos</CardTitle>
            {linkedClientId ? (
              <Button asChild size="sm">
                <Link href={`/projects/new?client_id=${linkedClientId}`}>Nuevo</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="px-0">
            {!linkedClientId ? (
              <ClientRequiredHint />
            ) : projects.length === 0 ? (
              <EmptyHint label="Sin proyectos." />
            ) : (
              <ul className="divide-border divide-y">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/projects/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <StatusBadge meta={PROJECT_STATUS} value={p.status as ProjectStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Invoices — require a linked client. */}
        <Card>
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!linkedClientId ? (
              <ClientRequiredHint />
            ) : invoices.length === 0 ? (
              <EmptyHint label="Sin facturas." />
            ) : (
              <ul className="divide-border divide-y">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {inv.full_number ?? 'Factura'}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge meta={INVOICE_STATUS} value={inv.status as InvoiceStatus} />
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatEUR(Number(inv.total ?? 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
