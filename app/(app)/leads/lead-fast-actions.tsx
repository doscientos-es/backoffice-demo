'use client'

import { Brain, Mail, MessageCircle, Phone, Sparkle as Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import type { LeadInteraction, LeadListItem } from '@/lib/leads/types'
import type { CallOutcome } from '@/lib/schemas/lead'
import { relativeTime } from '@/lib/utils'
import { todayIsoLocal } from '@/lib/utils/date'

import type { MomTestValues } from './[id]/mom-test-checklist'
import { MomTestQuickDialog } from './[id]/mom-test-quick-dialog'
import { logLeadCall, logLeadEmail } from './actions'
import { CallDateField } from './call-date-field'
import { CallDigestDialog } from './call-digest-dialog'
import { WhatsAppComposer } from './whatsapp-composer'

export type FastInteraction = LeadInteraction

export type FastLead = LeadListItem

type Props = {
  lead: FastLead
  aiEnabled: boolean
  senderName: string
}

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: 'Email enviado',
  email_received: 'Email recibido',
  email_delivered: 'Email entregado',
  email_opened: 'Email abierto',
  email_clicked: 'Email con clic',
  email_bounced: 'Email rebotado',
  email_complained: 'Email marcado como spam',
  email_scheduled: 'Email programado',
  email_delivery_delayed: 'Entrega de email retrasada',
  email_failed: 'Error al enviar el email',
  email_suppressed: 'Email suprimido',
  call: 'Llamada',
  meeting: 'Reunión',
  note: 'Nota',
  owner_change: 'Responsable cambiado',
  status_change: 'Cambio de estado',
  portal_view: 'Portal visto',
  portal_accept: 'Propuesta aceptada',
  portal_reject: 'Propuesta rechazada',
}

function excerpt(body: string | null, max = 120): string | null {
  if (!body) return null
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function WhatsAppFollowUp({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  senderName,
  aiEnabled,
  open,
  onOpenChange,
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  aiEnabled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preparar WhatsApp</DialogTitle>
          <DialogDescription>
            Has registrado 3 llamadas seguidas sin respuesta. Revisa el mensaje antes de abrir
            WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <WhatsAppComposer
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          senderName={senderName}
          aiEnabled={aiEnabled}
          draftKind="no_answer_recovery"
          draftInstructions="El lead no ha respondido a tres llamadas. Escribe un mensaje breve, humano y no insistente."
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function LeadFastActions({ lead, aiEnabled, senderName }: Props) {
  // Detenemos pointerdown para no activar el drag del kanban al pulsar
  // los iconos. En la vista lista es inocuo.
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click/drag propagation to the parent row/card; contains own interactive controls
    <div
      className="flex items-center gap-0.5"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <CallDialog
        leadId={lead.id}
        leadName={lead.name}
        leadEmail={lead.email}
        leadPhone={lead.phone}
        senderName={senderName}
        aiEnabled={aiEnabled}
        defaultDurationMinutes={lead.scheduled_meeting_duration_minutes}
      />
      <QuickWhatsAppDialog
        leadId={lead.id}
        leadName={lead.name}
        leadEmail={lead.email}
        leadPhone={lead.phone}
        senderName={senderName}
        aiEnabled={aiEnabled}
      />
      <EmailDialog leadId={lead.id} leadEmail={lead.email} />
      <MemoryHoverCard lead={lead} aiEnabled={aiEnabled} />
    </div>
  )
}

function QuickWhatsAppDialog({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  senderName,
  aiEnabled,
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  aiEnabled: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <FastDialog
      trigger={
        <IconTrigger label="Preparar WhatsApp">
          <MessageCircle className="size-3.5 text-emerald-600" />
        </IconTrigger>
      }
      title="Preparar WhatsApp"
      description="Envía el mensaje en WhatsApp y confírmalo después para registrarlo."
      open={open}
      onOpenChange={setOpen}
    >
      <WhatsAppComposer
        leadId={leadId}
        leadName={leadName}
        leadEmail={leadEmail}
        leadPhone={leadPhone}
        senderName={senderName}
        aiEnabled={aiEnabled}
        onSuccess={() => setOpen(false)}
      />
    </FastDialog>
  )
}

function IconTrigger({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground"
    >
      {children}
    </Button>
  )
}

function FastDialog({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  trigger: ReactNode
  title: string
  description?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

// ---------------- CALL ----------------

function CallDialog({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  senderName,
  aiEnabled,
  defaultDurationMinutes,
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  aiEnabled: boolean
  defaultDurationMinutes: number | null
}) {
  const [open, setOpen] = useState(false)
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestKey, setDigestKey] = useState(0)
  const [momTestOpen, setMomTestOpen] = useState(false)
  const [digestAfterMomTest, setDigestAfterMomTest] = useState(false)
  const [momTestValues, setMomTestValues] = useState<MomTestValues | null>(null)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState(() => defaultDurationMinutes?.toString() ?? '')
  const [callDate, setCallDate] = useState(todayIsoLocal)
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const feedback = useFormFeedback()
  const router = useRouter()

  useEffect(() => {
    if (open) setDuration(defaultDurationMinutes?.toString() ?? '')
  }, [defaultDurationMinutes, open])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    feedback.setPending()
    const res = await logLeadCall({
      leadId,
      notes: notes || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      outcome,
      callDate,
    })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Llamada registrada')
    setNotes('')
    setDuration(defaultDurationMinutes?.toString() ?? '')
    setCallDate(todayIsoLocal())
    setDigestKey((key) => key + 1)
    router.refresh()
    setOpen(false)
    if (res.showMomTestPrompt) {
      setMomTestValues(res.momTestValues)
      setDigestAfterMomTest(true)
      setMomTestOpen(true)
    } else if (outcome === 'connected') {
      setDigestOpen(true)
    } else if (res.noAnswerStreak === 3) {
      setWhatsappOpen(true)
    }
  }

  return (
    <>
      <FastDialog
        trigger={
          <IconTrigger label="Registrar llamada">
            <Phone className="size-3.5" />
          </IconTrigger>
        }
        title="Registrar llamada"
        description={leadPhone ? `Teléfono: ${leadPhone}` : 'Sin teléfono guardado.'}
        open={open}
        onOpenChange={setOpen}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`fast-call-outcome-${leadId}`} className="text-xs font-medium">
                Resultado
              </Label>
              <Select
                id={`fast-call-outcome-${leadId}`}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CallOutcome)}
              >
                <option value="connected">Contactado</option>
                <option value="no_answer">Sin respuesta</option>
                <option value="wrong_number">Número erróneo</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`fast-call-duration-${leadId}`} className="text-xs font-medium">
                Duración (min)
              </Label>
              <Input
                id={`fast-call-duration-${leadId}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="0"
              />
            </div>
            <CallDateField
              id={`fast-call-date-${leadId}`}
              value={callDate}
              onChange={setCallDate}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`fast-call-notes-${leadId}`} className="text-xs font-medium">
              Notas{' '}
              <span className="text-muted-foreground/60">(opcionales si no hubo contacto)</span>
            </Label>
            <Textarea
              id={`fast-call-notes-${leadId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Puntos clave, próximos pasos…"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
              Registrar
            </SubmitButton>
          </div>
        </form>
      </FastDialog>
      <CallDigestDialog
        leadId={leadId}
        leadName={leadName}
        leadEmail={leadEmail}
        leadPhone={leadPhone}
        senderName={senderName}
        aiEnabled={aiEnabled}
        open={digestOpen}
        onOpenChange={setDigestOpen}
        draftKey={digestKey}
      />
      <MomTestQuickDialog
        leadId={leadId}
        open={momTestOpen}
        onOpenChange={(nextOpen) => {
          setMomTestOpen(nextOpen)
          if (!nextOpen && digestAfterMomTest) {
            setDigestAfterMomTest(false)
            setDigestOpen(true)
          }
        }}
        initialValues={momTestValues}
      />
      <WhatsAppFollowUp
        leadId={leadId}
        leadName={leadName}
        leadEmail={leadEmail}
        leadPhone={leadPhone}
        senderName={senderName}
        aiEnabled={aiEnabled}
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
      />
    </>
  )
}

// ---------------- EMAIL (manual log) ----------------

function EmailDialog({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [counterparty, setCounterparty] = useState(leadEmail ?? '')
  const feedback = useFormFeedback()
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    feedback.setPending()
    const res = await logLeadEmail({
      leadId,
      direction,
      subject,
      bodyHtml: bodyHtml || undefined,
      counterparty: counterparty || undefined,
    })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Email registrado')
    setSubject('')
    setBodyHtml('')
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <FastDialog
      trigger={
        <IconTrigger label="Registrar email">
          <Mail className="size-3.5" />
        </IconTrigger>
      }
      title="Registrar email"
      description="Para emails enviados o recibidos fuera de la app."
      open={open}
      onOpenChange={setOpen}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`fast-email-dir-${leadId}`} className="text-xs font-medium">
              Dirección
            </Label>
            <Select
              id={`fast-email-dir-${leadId}`}
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')}
            >
              <option value="outgoing">Enviado</option>
              <option value="incoming">Recibido</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`fast-email-cp-${leadId}`} className="text-xs font-medium">
              {direction === 'incoming' ? 'De' : 'Para'}
            </Label>
            <Input
              id={`fast-email-cp-${leadId}`}
              type="email"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fast-email-subj-${leadId}`} className="text-xs font-medium">
            Asunto <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`fast-email-subj-${leadId}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={300}
            placeholder="Asunto del email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fast-email-body-${leadId}`} className="text-xs font-medium">
            Cuerpo <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id={`fast-email-body-${leadId}`}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={5}
            placeholder="Pega aquí el contenido del email…"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
            Registrar
          </SubmitButton>
        </div>
      </form>
    </FastDialog>
  )
}

// ---------------- MEMORY (hover card) ----------------

function MemoryHoverCard({ lead, aiEnabled }: { lead: FastLead; aiEnabled: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!aiEnabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/crm/ai/summarize-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al generar el resumen.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  const hasInteractions = lead.recent_interactions.length > 0
  const hasSummary = Boolean(lead.ai_summary)

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Memoria del lead"
          className="text-muted-foreground hover:text-foreground"
        >
          <Brain className="size-3.5" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-80 p-0">
        <div className="divide-border flex flex-col divide-y">
          <div className="px-3 py-2.5">
            <div className="text-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="size-3 opacity-60" />
              Descripción del lead
            </div>
            {hasSummary ? (
              <p className="text-muted-foreground text-xs leading-relaxed">{lead.ai_summary}</p>
            ) : (
              <p className="text-muted-foreground/80 text-xs leading-relaxed">
                Aún no hay descripción generada para este lead.
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              {aiEnabled ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  <Sparkles className="size-3" />
                  {loading ? 'Analizando…' : hasSummary ? 'Actualizar' : 'Generar con IA'}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled
                  title="Falta OPENAI_API_KEY en las variables de entorno"
                >
                  <Sparkles className="size-3 opacity-60" />
                  Generar con IA · No disponible
                </Button>
              )}
              {error ? <span className="text-destructive text-[10px]">{error}</span> : null}
            </div>
            {!aiEnabled ? (
              <p className="text-muted-foreground/70 mt-1.5 text-[10px] leading-snug">
                Sin clave de API configurada. La IA usará emails, llamadas y notas para resumir lo
                que pide el lead.
              </p>
            ) : null}
          </div>
          <div className="px-3 py-2.5">
            <div className="text-foreground mb-1.5 text-xs font-semibold">Últimas acciones</div>
            {hasInteractions ? (
              <ul className="flex flex-col gap-1.5">
                {lead.recent_interactions.slice(0, 3).map((i) => {
                  const snippet = excerpt(i.body, 90) ?? i.subject
                  return (
                    <li key={i.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-foreground font-medium">
                          {INTERACTION_LABEL[i.type] ?? i.type}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {relativeTime(i.created_at)}
                        </span>
                      </div>
                      {snippet ? (
                        <p className="text-muted-foreground line-clamp-2 text-[11px]">{snippet}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground/80 text-[11px]">
                Sin interacciones registradas todavía.
              </p>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
