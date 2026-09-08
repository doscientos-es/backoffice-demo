import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requireUser } from '@/lib/auth'
import {
  countNewsletterAudience,
  getAudienceLabel,
  listNewsletterIssues,
  NEWSLETTER_AUDIENCES,
  type NewsletterIssue,
} from '@/lib/marketing/newsletters'

import {
  createNewsletterIssueForm,
  publishNewsletterIssueForm,
  sendNewsletterIssueForm,
  sendNewsletterTestForm,
} from './actions'

export const metadata: Metadata = { title: 'Newsletters - doscientos' }
export const dynamic = 'force-dynamic'

const statusLabel: Record<NewsletterIssue['status'], string> = {
  draft: 'Borrador',
  scheduled: 'Planificada',
  sent: 'Enviada',
  published: 'Publicada',
  archived: 'Archivada',
}

const statusTone: Record<NewsletterIssue['status'], 'neutral' | 'info' | 'success' | 'warning'> = {
  draft: 'neutral',
  scheduled: 'info',
  sent: 'success',
  published: 'success',
  archived: 'warning',
}

function canSend(issue: NewsletterIssue): boolean {
  return !issue.sent_at && issue.status !== 'archived'
}

function fmtDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function rate(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

export default async function NewslettersPage() {
  await requireUser()
  const [issues, audienceCounts] = await Promise.all([
    listNewsletterIssues(),
    Promise.all(
      NEWSLETTER_AUDIENCES.map(async (audience) => ({
        key: audience.key,
        count: await countNewsletterAudience(audience.key),
      })),
    ),
  ])
  const counts = new Map(audienceCounts.map((audience) => [audience.key, audience.count]))
  const scheduled = issues.filter((issue) => issue.status === 'scheduled').length
  const published = issues.filter((issue) => issue.published_at).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Newsletters"
        description="Planifica recursos, decide a quien llegan y conserva cada envio como activo publico."
        breadcrumbs={[{ label: 'Marketing', href: '/marketing' }, { label: 'Newsletters' }]}
        actions={
          <Button asChild variant="outline">
            <Link href="https://doscientos.es/recursos" target="_blank">
              Ver recursos
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total</CardDescription>
            <CardTitle>{issues.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Planificadas</CardDescription>
            <CardTitle>{scheduled}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Publicadas como recurso</CardDescription>
            <CardTitle>{published}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Calendario editorial</CardTitle>
            <CardDescription>Issues preparadas para enviar, publicar y medir.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Newsletter</th>
                    <th className="py-2 pr-3 font-medium">Audiencia</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 text-right font-medium">Envios</th>
                    <th className="py-2 pr-3 text-right font-medium">Open</th>
                    <th className="py-2 pr-3 text-right font-medium">Click</th>
                    <th className="py-2 text-right font-medium">Uso</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {issues.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-muted-foreground py-8 text-center">
                        Aun no hay newsletters.
                      </td>
                    </tr>
                  ) : (
                    issues.map((issue) => (
                      <tr key={issue.id} className="align-top">
                        <td className="max-w-sm py-3 pr-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{issue.title}</span>
                              <Badge variant={statusTone[issue.status]}>
                                {statusLabel[issue.status]}
                              </Badge>
                            </div>
                            <span className="text-muted-foreground line-clamp-1">
                              {issue.subject}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-3">{getAudienceLabel(issue.audience_key)}</td>
                        <td className="py-3 pr-3">
                          {fmtDate(issue.scheduled_at ?? issue.published_at ?? issue.created_at)}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">{issue.total_sends}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          {rate(issue.total_opens, issue.total_sends)}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          {rate(issue.total_clicks, issue.total_sends)}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col items-end gap-2">
                            <form
                              action={sendNewsletterTestForm}
                              className="flex justify-end gap-2"
                            >
                              <input type="hidden" name="id" value={issue.id} />
                              <Input
                                name="testEmail"
                                type="email"
                                placeholder="prueba@..."
                                className="h-7 w-40"
                                aria-label="Email de prueba"
                              />
                              <Button type="submit" variant="outline" size="sm">
                                Test
                              </Button>
                            </form>

                            <div className="flex flex-wrap justify-end gap-2">
                              {issue.published_at ? (
                                <Button asChild variant="ghost" size="sm">
                                  <Link
                                    href={`https://doscientos.es/recursos/${issue.public_slug ?? issue.slug}`}
                                    target="_blank"
                                  >
                                    Abrir
                                  </Link>
                                </Button>
                              ) : (
                                <form action={publishNewsletterIssueForm}>
                                  <input type="hidden" name="id" value={issue.id} />
                                  <Button type="submit" variant="outline" size="sm">
                                    Publicar
                                  </Button>
                                </form>
                              )}

                              {canSend(issue) ? (
                                <form
                                  action={sendNewsletterIssueForm}
                                  className="flex items-center gap-2"
                                >
                                  <input type="hidden" name="id" value={issue.id} />
                                  <label className="text-muted-foreground flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      name="confirmSend"
                                      className="border-border size-3.5 rounded"
                                    />
                                    confirmar
                                  </label>
                                  <Button type="submit" size="sm">
                                    Enviar
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Envio seguro</CardTitle>
              <CardDescription>
                Primero envia un test. El envio definitivo va a la audiencia seleccionada, guarda
                cada destinatario y excluye emails dados de baja.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground grid gap-2 text-sm">
              <div>Limite operativo inicial: 500 destinatarios por newsletter.</div>
              <div>Solo owners y admins pueden hacer el envio definitivo.</div>
              <div>Los clics y aperturas se registran en la campana enlazada.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nueva newsletter</CardTitle>
              <CardDescription>Creala como recurso y decide la audiencia inicial.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createNewsletterIssueForm} className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="title">Titulo interno y publico</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    placeholder="Checklist para priorizar automatizaciones"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="subject">Asunto</Label>
                  <Input
                    id="subject"
                    name="subject"
                    required
                    placeholder="Que proceso deberias automatizar primero"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="previewText">Preview</Label>
                  <Input
                    id="previewText"
                    name="previewText"
                    placeholder="Una forma rapida de detectar trabajo manual caro."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="audienceKey">Audiencia</Label>
                  <select
                    id="audienceKey"
                    name="audienceKey"
                    defaultValue="active_leads"
                    className="border-border bg-background h-8 rounded-lg border px-2.5 text-sm"
                  >
                    {NEWSLETTER_AUDIENCES.map((audience) => (
                      <option key={audience.key} value={audience.key}>
                        {audience.label} - {counts.get(audience.key) ?? 0}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="scheduledAt">Fecha prevista</Label>
                  <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bodyMarkdown">Contenido</Label>
                  <Textarea
                    id="bodyMarkdown"
                    name="bodyMarkdown"
                    required
                    className="min-h-44"
                    placeholder="Problema, diagnostico, recurso util y siguiente paso."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ctaLabel">CTA</Label>
                    <Input id="ctaLabel" name="ctaLabel" placeholder="Pedir diagnostico" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ctaUrl">URL</Label>
                    <Input id="ctaUrl" name="ctaUrl" placeholder="/contacto?ref=newsletter" />
                  </div>
                </div>
                <label className="text-muted-foreground flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="publishNow"
                    className="border-border size-4 rounded"
                  />
                  Publicar ya como recurso
                </label>
                <Button type="submit">Guardar newsletter</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audiencias</CardTitle>
              <CardDescription>Base estimada antes de enviar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {NEWSLETTER_AUDIENCES.map((audience) => (
                <div key={audience.key} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{audience.label}</div>
                    <div className="text-muted-foreground text-xs">{audience.description}</div>
                  </div>
                  <Badge variant="outline">{counts.get(audience.key) ?? 0}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
