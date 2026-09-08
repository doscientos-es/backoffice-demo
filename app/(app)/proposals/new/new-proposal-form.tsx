'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { LineItemsTable } from '@/components/finance/line-items-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { EntityCombobox } from '@/components/ui/entity-combobox'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EMPTY_LINE_ITEM, type LineItem } from '@/lib/finance'

import { createProposalAction } from '../actions'

type Props = {
  clients: Array<{ id: string; name: string }>
  leads: Array<{ id: string; name: string; company: string | null; status: string }>
  projects: Array<{ id: string; name: string; client_id: string }>
  initialClientId?: string
  initialLeadId?: string
  aiEnabled: boolean
}

type Recipient = { kind: 'client'; id: string } | { kind: 'lead'; id: string } | null

/**
 * Explicit create flow for proposals. The detail page (`/proposals/[id]`)
 * owns the autosave-driven collaborative editor; here the user fills a draft
 * and confirms with a single click — on success we navigate to the detail
 * view where further edits are autosaved.
 *
 * The recipient is either an existing client OR an open lead: the proposal
 * never targets a project (projects are auto-generated on acceptance).
 */
export function NewProposalForm({
  clients,
  leads,
  projects,
  initialClientId,
  initialLeadId,
  aiEnabled,
}: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 4000 })
  const [pending, startTransition] = useTransition()

  const [recipient, setRecipient] = useState<Recipient>(() => {
    if (initialClientId) return { kind: 'client', id: initialClientId }
    if (initialLeadId) return { kind: 'lead', id: initialLeadId }
    return null
  })
  const recipientValue = recipient ? `${recipient.kind}:${recipient.id}` : ''
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [projectId, setProjectId] = useState('')

  // Projects available for the selected client
  const clientProjects = useMemo(
    () =>
      recipient?.kind === 'client' ? projects.filter((p) => p.client_id === recipient.id) : [],
    [projects, recipient],
  )
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM, id: crypto.randomUUID() }])

  const selectedRecipient = useMemo(() => {
    if (!recipient) return null
    return recipient.kind === 'lead'
      ? (leads.find((lead) => lead.id === recipient.id) ?? null)
      : (clients.find((client) => client.id === recipient.id) ?? null)
  }, [clients, leads, recipient])

  const canSubmit = Boolean(recipient)

  function handleCreate(mode: 'blank' | 'ai') {
    if (!canSubmit || pending || !recipient) {
      feedback.setError('Selecciona el destinatario de la propuesta')
      return
    }
    if (mode === 'ai' && recipient.kind !== 'lead') {
      feedback.setError('El prerrelleno con IA necesita una propuesta vinculada a un lead')
      return
    }

    const validItems = items.filter(
      (item) => item.description.trim().length > 0 && Number(item.quantity) > 0,
    )
    const proposalItems =
      validItems.length > 0
        ? validItems
        : [
            {
              ...EMPTY_LINE_ITEM,
              id: crypto.randomUUID(),
              description: 'Pendiente de definir',
              quantity: 1,
            },
          ]
    const defaultTitle = selectedRecipient
      ? `Propuesta para ${selectedRecipient.name}`
      : 'Nueva propuesta'

    feedback.setPending()
    startTransition(async () => {
      const res = await createProposalAction({
        client_id: recipient.kind === 'client' ? recipient.id : undefined,
        lead_id: recipient.kind === 'lead' ? recipient.id : undefined,
        project_id: projectId || undefined,
        title: title.trim() || defaultTitle,
        valid_until: validUntil || undefined,
        notes: notes || undefined,
        items: proposalItems.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
          billing_cycle: it.billing_cycle ?? 'none',
        })),
      })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess('Propuesta creada')
      // A draft is internal work; the lead moves to Presupuestado only when
      // the proposal is actually delivered from its detail page.
      router.push(`/proposals/${res.id}${mode === 'ai' ? '?ai_draft=1' : '?mode=edit'}`)
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleCreate('blank')
  }

  function onRecipientChange(value: string) {
    setProjectId('') // reset project when recipient changes
    if (!value) {
      setRecipient(null)
      return
    }
    const [kind, id] = value.split(':', 2)
    if ((kind === 'client' || kind === 'lead') && id) {
      setRecipient({ kind, id })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground mb-4 text-xs">
            Solo el destinatario es obligatorio. Puedes completar el resto ahora o abrir el borrador
            y editarlo después.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow
              label="Destinatario"
              htmlFor="recipient"
              required
              hint="Cliente existente o lead. Si es lead, le pediremos sus datos fiscales al aceptar."
            >
              <EntityCombobox
                id="recipient"
                items={[
                  ...clients.map((c) => ({ id: `client:${c.id}`, label: c.name })),
                  ...leads.map((l) => ({
                    id: `lead:${l.id}`,
                    label: l.name,
                    sublabel: l.company,
                  })),
                ]}
                value={recipientValue}
                onChange={onRecipientChange}
                placeholder="Buscar cliente o lead…"
                required
              />
            </FormRow>
            <FormRow label="Título" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                autoFocus
                placeholder="Propuesta de servicios"
              />
            </FormRow>
            <FormRow label="Válida hasta" htmlFor="valid_until" hint="Fecha límite de aceptación.">
              <DateField id="valid_until" value={validUntil} onChange={setValidUntil} />
            </FormRow>
            {clientProjects.length > 0 && (
              <FormRow
                label="Proyecto"
                htmlFor="project_id"
                hint="Opcional. Vincula esta propuesta a un proyecto existente."
              >
                <EntityCombobox
                  id="project_id"
                  items={clientProjects.map((p) => ({ id: p.id, label: p.name }))}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="Buscar proyecto…"
                />
              </FormRow>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-sm font-semibold">Líneas</h2>
          <LineItemsTable items={items} onChange={setItems} showBillingCycle />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <FormRow
            label="Notas"
            htmlFor="notes"
            hint="Condiciones generales, alcance o aclaraciones para el cliente."
          >
            <Textarea
              id="notes"
              rows={4}
              maxLength={4000}
              placeholder="Condiciones, alcance, observaciones…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormRow>
        </CardContent>
      </Card>

      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <FormFeedback state={feedback.state} pendingLabel="Creando…" />
        <Button asChild variant="ghost" size="sm">
          <Link href="/proposals">Cancelar</Link>
        </Button>
        <Button type="submit" size="sm" disabled={pending || !canSubmit}>
          {pending ? 'Creando…' : 'Crear en blanco'}
        </Button>
        {aiEnabled ? (
          <Button
            type="button"
            size="sm"
            disabled={pending || !canSubmit || recipient?.kind !== 'lead'}
            onClick={() => handleCreate('ai')}
            title={
              recipient?.kind !== 'lead'
                ? 'Selecciona un lead para usar su contexto con IA'
                : undefined
            }
          >
            {pending ? 'Creando…' : 'Crear y prerrellenar con IA'}
          </Button>
        ) : null}
      </div>
      {aiEnabled ? (
        <p className="text-muted-foreground -mt-3 text-right text-xs">
          La IA usa ficha, notas, interacciones y llamadas del lead. No propone importes ni
          condiciones que no consten en el CRM.
        </p>
      ) : null}
    </form>
  )
}
