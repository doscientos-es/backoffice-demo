import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RemindersSection } from '@/app/(app)/inicio/_components/reminders-section'
import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { CopySummaryButton } from '@/components/ui/copy-summary-button'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatAddress } from '@/lib/address'
import { requireUser } from '@/lib/auth'
import { getClientDetail } from '@/lib/clients/queries'
import { listActiveMembers } from '@/lib/members/queries'
import {
  INVOICE_STATUS,
  type InvoiceStatus,
  PROJECT_STATUS,
  PROPOSAL_STATUS,
  type ProjectStatus,
  type ProposalStatus,
  TASK_STATUS,
  type TaskStatus,
} from '@/lib/status'
import { formatDate, formatEUR } from '@/lib/utils'

import { ScheduleReminderDialog } from '../../reminders/schedule-reminder-dialog'
import { TaskCreateDialog } from '../../tasks/task-create-dialog'
import { ClientEditDialog } from './client-edit-dialog'
import { DeleteClientButton } from './delete-client-button'
import { FiscalVerificationCard } from './fiscal-verification-card'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const canEdit = user.role !== 'viewer'

  const [result, members] = await Promise.all([
    getClientDetail(id),
    canEdit ? listActiveMembers() : Promise.resolve([]),
  ])
  if (!result) notFound()

  const { client, originLead, projects, proposals, invoices, tasks, reminders } = result

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={(client.label as string | null)?.trim() || (client.name as string)}
        description={(client.nif as string | null) ?? undefined}
        icon={
          <EntityAvatar
            name={(client.label as string | null)?.trim() || (client.name as string)}
            logoUrl={(client.logo_url as string | null) ?? null}
            size="lg"
          />
        }
        breadcrumbs={[
          { label: 'Clientes', href: '/clients' },
          { label: (client.label as string | null)?.trim() || (client.name as string) },
        ]}
        actions={
          user.role !== 'viewer' ? (
            <div className="flex items-center gap-2">
              <CopySummaryButton
                lines={[
                  [
                    `👤 ${(client.label as string | null)?.trim() || (client.name as string)}`,
                    (client.nif as string | null) ? `(${client.nif as string})` : null,
                  ]
                    .filter(Boolean)
                    .join(' '),
                  ...((
                    [
                      (client.email as string | null) ? `Email: ${client.email as string}` : null,
                      (client.phone as string | null) ? `Tel: ${client.phone as string}` : null,
                    ].filter(Boolean) as string[]
                  ).length > 0
                    ? [
                        [
                          (client.email as string | null) && `Email: ${client.email as string}`,
                          (client.phone as string | null) && `Tel: ${client.phone as string}`,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      ]
                    : []),
                  (client.contact_person as string | null)
                    ? `Contacto: ${client.contact_person as string}`
                    : null,
                  formatAddress({
                    street: client.billing_address_street as string | null,
                    zip: client.billing_address_zip as string | null,
                    city: client.billing_address_city as string | null,
                    province: client.billing_address_province as string | null,
                    country: client.billing_address_country as string | null,
                  })
                    ? `Dirección: ${formatAddress({
                        street: client.billing_address_street as string | null,
                        zip: client.billing_address_zip as string | null,
                        city: client.billing_address_city as string | null,
                        province: client.billing_address_province as string | null,
                        country: client.billing_address_country as string | null,
                      }).replace(/\n/g, ', ')}`
                    : null,
                ].filter((x): x is string => Boolean(x))}
                urlPath={`/clients/${client.id as string}`}
              />
              <ClientEditDialog
                client={{
                  id: client.id as string,
                  name: client.name as string,
                  label: (client.label as string | null) ?? null,
                  nif: (client.nif as string | null) ?? null,
                  email: (client.email as string | null) ?? null,
                  phone: (client.phone as string | null) ?? null,
                  contact_person: (client.contact_person as string | null) ?? null,
                  billing_address_street: (client.billing_address_street as string | null) ?? null,
                  billing_address_zip: (client.billing_address_zip as string | null) ?? null,
                  billing_address_city: (client.billing_address_city as string | null) ?? null,
                  billing_address_province:
                    (client.billing_address_province as string | null) ?? null,
                  billing_address_country:
                    (client.billing_address_country as string | null) ?? null,
                  notes: (client.notes as string | null) ?? null,
                  logo_url: (client.logo_url as string | null) ?? null,
                  version: Number(client.version),
                }}
              />
              <DeleteClientButton clientId={client.id as string} />
            </div>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailRow label="Email">{(client.email as string | null) ?? '—'}</DetailRow>
            <DetailRow label="Teléfono">{(client.phone as string | null) ?? '—'}</DetailRow>
            <DetailRow label="Contacto">
              {(client.contact_person as string | null) ?? '—'}
            </DetailRow>
            {originLead ? (
              <DetailRow label="Lead de origen">
                <Link href={`/leads/${originLead.id}`} className="hover:underline">
                  {originLead.company ? `${originLead.name} · ${originLead.company}` : originLead.name}
                </Link>
              </DetailRow>
            ) : null}
            <DetailRow label="Creado">{formatDate(client.created_at as string)}</DetailRow>
          </DetailGrid>
          {formatAddress({
            street: client.billing_address_street as string | null,
            zip: client.billing_address_zip as string | null,
            city: client.billing_address_city as string | null,
            province: client.billing_address_province as string | null,
            country: client.billing_address_country as string | null,
          }) ? (
            <div className="border-border mt-4 border-t pt-3">
              <div className="mb-1 flex items-center gap-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Dirección
                </p>
                <CopyButton
                  text={formatAddress({
                    street: client.billing_address_street as string | null,
                    zip: client.billing_address_zip as string | null,
                    city: client.billing_address_city as string | null,
                    province: client.billing_address_province as string | null,
                    country: client.billing_address_country as string | null,
                  }).replace(/\n/g, ', ')}
                  successMessage="Dirección copiada"
                  label="Copiar dirección completa"
                />
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {formatAddress({
                  street: client.billing_address_street as string | null,
                  zip: client.billing_address_zip as string | null,
                  city: client.billing_address_city as string | null,
                  province: client.billing_address_province as string | null,
                  country: client.billing_address_country as string | null,
                })}
              </p>
            </div>
          ) : null}
          {client.notes ? (
            <div className="border-border mt-4 border-t pt-3">
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Notas
              </p>
              <p className="text-sm whitespace-pre-wrap">{client.notes as string}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validación fiscal</CardTitle>
        </CardHeader>
        <CardContent>
          <FiscalVerificationCard
            clientId={client.id}
            initialStatus={client.fiscal_verification_status}
            initialVerifiedAt={client.fiscal_verified_at}
            canValidate={canEdit}
          />
        </CardContent>
      </Card>

      {canEdit || reminders.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Próximos avisos</CardTitle>
            {canEdit && (
              <ScheduleReminderDialog
                clientId={id}
                members={members}
                trigger={
                  <Button size="sm" variant="outline">
                    Agendar aviso
                  </Button>
                }
              />
            )}
          </CardHeader>
          <CardContent>
            {reminders.length > 0 ? (
              <RemindersSection reminders={reminders} />
            ) : (
              <p className="text-muted-foreground text-sm">Sin avisos programados.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canEdit || tasks.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tareas</CardTitle>
            {canEdit ? (
              <TaskCreateDialog
                clientId={id}
                members={members}
                currentUserId={user.id}
                trigger={<Button size="sm">Nueva tarea</Button>}
              />
            ) : null}
          </CardHeader>
          <CardContent className="px-0">
            {tasks.length > 0 ? (
              <ul className="divide-border divide-y">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/tasks/${task.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {task.title}
                    </Link>
                    <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
                      <StatusBadge meta={TASK_STATUS} value={task.status as TaskStatus} />
                      {task.due_date ? <span>{formatDate(task.due_date)}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground px-6 py-2 text-sm">Sin tareas.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Proyectos</CardTitle>
            <Button asChild size="sm">
              <Link href={`/projects/new?client_id=${id}`}>Nuevo</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {!projects || projects.length === 0 ? (
              <p className="text-muted-foreground px-6 py-2 text-sm">Sin proyectos.</p>
            ) : (
              <ul className="divide-border divide-y">
                {projects.map((p) => (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/projects/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.name as string}
                    </Link>
                    <StatusBadge meta={PROJECT_STATUS} value={p.status as ProjectStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Proposals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Propuestas</CardTitle>
            <Button asChild size="sm">
              <Link href={`/proposals/new?client_id=${id}`}>Nueva</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {!proposals || proposals.length === 0 ? (
              <p className="text-muted-foreground px-6 py-2 text-sm">Sin propuestas.</p>
            ) : (
              <ul className="divide-border divide-y">
                {proposals.map((p) => (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/proposals/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.number as string}
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

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!invoices || invoices.length === 0 ? (
              <p className="text-muted-foreground px-6 py-2 text-sm">Sin facturas.</p>
            ) : (
              <ul className="divide-border divide-y">
                {invoices.map((inv) => (
                  <li
                    key={inv.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {inv.full_number as string}
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
    </div>
  )
}
