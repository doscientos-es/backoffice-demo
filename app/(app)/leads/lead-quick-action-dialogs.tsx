'use client'

// Compartido entre el drawer de la lista de leads y la ficha del lead.
// Única fuente de verdad para las 3 fast actions (llamada, email, nota)
// con opción de agendar follow-up. Todas refrescan el router tras éxito.

import {
  FileText,
  LoaderCircle as Loader2,
  Mail,
  MessageCircle,
  Notebook as NotebookPen,
  Phone,
  Send,
  Video,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type SubmitEvent, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EntityCombobox } from '@/components/ui/entity-combobox'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_MEETING_DURATION,
  MEETING_DURATIONS,
  type MeetingDuration,
  defaultMeetingStart,
} from '@/lib/calendar/date-presets'
import { publicEnv } from '@/lib/env'
import { buildLeadWhatsAppMessage } from '@/lib/leads/whatsapp'
import { buildBookingUrl } from '@/lib/recovery/utils'
import { defaultFollowUpDateTime } from '@/lib/reminders/date-presets'
import type { CallOutcome } from '@/lib/schemas/lead'
import { cn } from '@/lib/utils'
import { todayIsoLocal } from '@/lib/utils/date'
import { addMinutesToDatetimeLocal, datetimeLocalToIso } from '@/lib/utils/date-time'

import { createReminder } from '../reminders/actions'
import { EmailComposer } from './[id]/email-composer'
import type { MomTestValues } from './[id]/mom-test-checklist'
import { MomTestQuickDialog } from './[id]/mom-test-quick-dialog'
import { logLeadCall, logLeadEmail, logLeadNote, scheduleLeadMeeting } from './actions'
import { CallDateField } from './call-date-field'
import { CallDigestDialog } from './call-digest-dialog'
import { WhatsAppComposer } from './whatsapp-composer'

// ─── QMeetDialog ──────────────────────────────────────────────────────────────

/** Shape passed for Meet invitee selection — subset of team_members with email. */
export type MeetMember = { id: string; name: string; email: string }

function LastAttemptDialog({
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
  aiEnabled?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const message = buildLeadWhatsAppMessage(
    { id: leadId, name: leadName, email: leadEmail },
    senderName,
    publicEnv.NEXT_PUBLIC_CAL_LINK,
  )
  const firstName = leadName.split(' ')[0] || leadName
  const bookingUrl = buildBookingUrl(publicEnv.NEXT_PUBLIC_CAL_LINK, {
    id: leadId,
    name: leadName,
    email: leadEmail,
  })
  const emailSubject = `¿Hablamos sobre lo que necesitas, ${firstName}?`
  const emailBody = [
    `Hola ${firstName},`,
    `\nSoy ${senderName || 'el equipo'}, de Doscientos.`,
    '\nNos dejaste tus datos al completar un formulario en uno de nuestros anuncios de Meta. Te escribo porque he intentado llamarte varias veces, pero no he conseguido localizarte.',
    '\nNos gustaría entender qué necesitas y ver si podemos ayudarte.',
    bookingUrl
      ? `\nPuedes responderme a este email o, si te va mejor, agendar directamente una reunión aquí: ${bookingUrl}`
      : '\nPuedes responderme a este email y buscamos un momento para hablar.',
    '\n¿Qué opción te resulta más cómoda?',
    '\nUn saludo,',
    senderName || 'El equipo de Doscientos',
  ].join('\n')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Último intento de contacto</DialogTitle>
          <DialogDescription>
            Has registrado 3 llamadas seguidas sin respuesta. Revisa y corrige el mensaje que
            prefieras usar. No se envía nada automáticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              channel === 'whatsapp' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setChannel('email')}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              channel === 'email' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            Email
          </button>
        </div>
        {channel === 'whatsapp' ? (
          <WhatsAppComposer
            leadId={leadId}
            leadName={leadName}
            leadEmail={leadEmail}
            leadPhone={leadPhone}
            senderName={senderName}
            aiEnabled={aiEnabled}
            defaultMessage={message}
            draftKind="no_answer_recovery"
            draftInstructions="El lead no ha respondido a tres llamadas. Escribe un mensaje breve, humano y no insistente. Explica el origen del contacto y ofrece responder o agendar una reunión."
            onSuccess={() => onOpenChange(false)}
          />
        ) : (
          <EmailComposer
            leadId={leadId}
            defaultTo={leadEmail ?? ''}
            defaultSubject={emailSubject}
            defaultBody={emailBody}
            draftKind="no_answer_recovery"
            draftInstructions="El lead no ha respondido a tres llamadas. Mantén un tono breve, humano y no insistente. Explica que sus datos proceden de un formulario de un anuncio de Meta y ofrece responder o agendar una reunión."
            disabled={!leadEmail}
            disabledReason="Este lead no tiene email registrado."
            aiEnabled={aiEnabled}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Shared helper: member checkboxes ────────────────────────────────────────

function MemberCheckboxes({
  members,
  selected,
  onToggle,
}: {
  members: MeetMember[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (members.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">
        Invitar compañeros <span className="text-muted-foreground/60">(opcional)</span>
      </Label>
      <div className="border-border/60 bg-muted/30 flex flex-col gap-1.5 rounded-md border p-2.5">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Checkbox
              id={`member-${m.id}`}
              isSelected={selected.has(m.id)}
              onChange={() => onToggle(m.id)}
            />
            <label
              htmlFor={`member-${m.id}`}
              className="flex-1 cursor-pointer py-0.5 text-sm select-none"
            >
              {m.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

function useMemberToggle() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function emails(members: MeetMember[]) {
    return members.filter((m) => selected.has(m.id)).map((m) => m.email)
  }
  return { selected, toggle, emails }
}

// ─── QMeetDialog — scheduled meeting ─────────────────────────────────────────

export function QMeetDialog({
  leadId,
  leadName,
  leadEmail,
  projects,
  meetMembers = [],
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  projects: Array<{ id: string; name: string }>
  meetMembers?: MeetMember[]
}) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [title, setTitle] = useState(`Reunión con ${leadName}`)
  const [start, setStart] = useState(defaultMeetingStart)
  const [duration, setDuration] = useState<MeetingDuration>(DEFAULT_MEETING_DURATION)
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const members = useMemberToggle()
  const feedback = useFormFeedback()
  const router = useRouter()

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setConfirmOpen(true)
  }

  async function handleConfirmSchedule() {
    feedback.setPending()
    const attendeeEmails = [...(leadEmail ? [leadEmail] : []), ...members.emails(meetMembers)]
    const res = await scheduleLeadMeeting({
      leadId,
      title,
      description: description.trim() || undefined,
      start: datetimeLocalToIso(start),
      end: datetimeLocalToIso(addMinutesToDatetimeLocal(start, duration)),
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      projectId: projectId || undefined,
      withMeet: true,
    })
    if (!res.ok) {
      setConfirmOpen(false)
      return feedback.setError(res.error)
    }
    setConfirmOpen(false)
    feedback.setSuccess('Reunión creada')
    router.refresh()
    if (res.meetUrl) window.open(res.meetUrl, '_blank')
    setTimeout(() => setOpen(false), 600)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Video className="text-muted-foreground size-3.5" />
            Agendar reunión Meet
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar reunión Google Meet</DialogTitle>
            <DialogDescription>
              {leadEmail
                ? 'Se creará en el calendario compartido y se enviará una invitación por email.'
                : 'Se creará en el calendario compartido. Este lead no tiene email registrado.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-meet-title-${leadId}`} className="text-xs font-medium">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`qa-meet-title-${leadId}`}
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-start-${leadId}`} className="text-xs font-medium">
                  Inicio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`qa-meet-start-${leadId}`}
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-duration-${leadId}`} className="text-xs font-medium">
                  Duración <span className="text-destructive">*</span>
                </Label>
                <Select
                  id={`qa-meet-duration-${leadId}`}
                  required
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) as MeetingDuration)}
                >
                  {MEETING_DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutos
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {projects.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-project-${leadId}`} className="text-xs font-medium">
                  Proyecto <span className="text-muted-foreground/60">(opcional)</span>
                </Label>
                <EntityCombobox
                  id={`qa-meet-project-${leadId}`}
                  items={projects.map((p) => ({ id: p.id, label: p.name }))}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="Buscar proyecto…"
                />
              </div>
            )}
            <MemberCheckboxes
              members={meetMembers}
              selected={members.selected}
              onToggle={members.toggle}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-meet-desc-${leadId}`} className="text-xs font-medium">
                Descripción <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-meet-desc-${leadId}`}
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, puntos a tratar…"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Creando…" />
              <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
                Agendar reunión
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={leadEmail ? '¿Enviar invitación de reunión?' : '¿Crear reunión sin invitar al lead?'}
        description={
          <>
            {leadEmail ? (
              <p>
                Se enviará una invitación real de Google Calendar a <strong>{leadEmail}</strong>.
              </p>
            ) : (
              <p>Este lead no tiene email registrado y no recibirá una invitación.</p>
            )}
            <p className="mt-2">
              <strong>{title}</strong> · {start.replace('T', ' ')}.
            </p>
            <p className="mt-2">
              {leadEmail
                ? 'El lead recibirá la invitación en su calendario.'
                : 'La reunión se creará sin invitación para el lead.'}
            </p>
          </>
        }
        confirmLabel={leadEmail ? 'Sí, enviar invitación' : 'Sí, crear reunión'}
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmSchedule()}
      />
    </>
  )
}

// ─── QMeetNowDialog — instant Meet ───────────────────────────────────────────

export function QMeetNowDialog({
  leadId,
  leadName,
  leadEmail,
  meetMembers = [],
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  meetMembers?: MeetMember[]
}) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [description, setDescription] = useState('')
  const members = useMemberToggle()
  const feedback = useFormFeedback()
  const router = useRouter()

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setConfirmOpen(true)
  }

  async function handleConfirmCreate() {
    feedback.setPending()
    const now = new Date()
    const endTime = new Date(now.getTime() + 60 * 60 * 1000)
    const attendeeEmails = [...(leadEmail ? [leadEmail] : []), ...members.emails(meetMembers)]
    const res = await scheduleLeadMeeting({
      leadId,
      title: `Reunión con ${leadName}`,
      description: description.trim() || undefined,
      start: now.toISOString(),
      end: endTime.toISOString(),
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      withMeet: true,
    })
    if (!res.ok) {
      setConfirmOpen(false)
      return feedback.setError(res.error)
    }
    setConfirmOpen(false)
    feedback.setSuccess('¡Meet creado!')
    router.refresh()
    if (res.meetUrl) window.open(res.meetUrl, '_blank')
    setTimeout(() => setOpen(false), 600)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Video className="size-3.5 text-green-500" />
            Meet ahora
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar Meet ahora</DialogTitle>
            <DialogDescription>
              {leadEmail
                ? 'Se crea el enlace Meet, se abre en una nueva pestaña y se envía invitación.'
                : 'Se crea el enlace Meet y se abre en una nueva pestaña. Este lead no tiene email registrado.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <MemberCheckboxes
              members={meetMembers}
              selected={members.selected}
              onToggle={members.toggle}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-now-desc-${leadId}`} className="text-xs font-medium">
                Notas <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-now-desc-${leadId}`}
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, puntos a tratar…"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Creando…" />
              <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
                Crear y unirse
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={leadEmail ? '¿Enviar invitación y abrir Meet?' : '¿Crear Meet sin invitar al lead?'}
        description={
          <>
            {leadEmail ? (
              <p>
                Se enviará una invitación real de Google Calendar a <strong>{leadEmail}</strong>.
              </p>
            ) : (
              <p>Este lead no tiene email registrado y no recibirá una invitación.</p>
            )}
            <p className="mt-2">También se abrirá el enlace de Meet en una nueva pestaña.</p>
          </>
        }
        confirmLabel={leadEmail ? 'Sí, crear y enviar' : 'Sí, crear y abrir Meet'}
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmCreate()}
      />
    </>
  )
}

function FollowUpSection({
  idPrefix,
  enabled,
  onEnabledChange,
  remindAt,
  onRemindAtChange,
}: {
  idPrefix: string
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  remindAt: string
  onRemindAtChange: (v: string) => void
}) {
  return (
    <div className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-md border p-2.5">
      <label
        htmlFor={`${idPrefix}-followup`}
        className="flex items-center gap-2 text-xs font-medium"
      >
        <Checkbox id={`${idPrefix}-followup`} isSelected={enabled} onChange={onEnabledChange} />
        Crear aviso de seguimiento
      </label>
      {enabled && (
        <Input
          id={`${idPrefix}-followup-at`}
          type="datetime-local"
          value={remindAt}
          onChange={(e) => onRemindAtChange(e.target.value)}
          className="h-8 text-xs"
        />
      )}
    </div>
  )
}

export function QCallDialog({
  leadId,
  leadName,
  leadPhone,
  leadEmail,
  senderName,
  aiEnabled,
  openInitially = false,
  defaultDurationMinutes = null,
}: {
  leadId: string
  leadName: string
  leadPhone: string | null
  leadEmail: string | null
  senderName: string
  aiEnabled?: boolean
  openInitially?: boolean
  defaultDurationMinutes?: number | null
}) {
  const [open, setOpen] = useState(false)
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestKey, setDigestKey] = useState(0)
  const [momTestOpen, setMomTestOpen] = useState(false)
  const [digestAfterMomTest, setDigestAfterMomTest] = useState(false)
  const [momTestValues, setMomTestValues] = useState<MomTestValues | null>(null)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [duration, setDuration] = useState(() => defaultDurationMinutes?.toString() ?? '')
  const [callDate, setCallDate] = useState(todayIsoLocal)
  const [notes, setNotes] = useState('')
  const [transcript, setTranscript] = useState('')
  const [followUpEnabled, setFollowUpEnabled] = useState(false)
  const [followUpAt, setFollowUpAt] = useState(defaultFollowUpDateTime)
  // Meet notes import
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const feedback = useFormFeedback()
  const router = useRouter()

  useEffect(() => {
    if (openInitially) setOpen(true)
  }, [openInitially])

  useEffect(() => {
    if (open) setDuration(defaultDurationMinutes?.toString() ?? '')
  }, [defaultDurationMinutes, open])

  async function handleImportNotes() {
    setImporting(true)
    setImportError(null)
    try {
      const res = await fetch('/api/crm/meet-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_url: importUrl }),
      })
      const json = (await res.json()) as { text?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Error al importar')
      setNotes(json.text ?? '')
      setShowImport(false)
      setImportUrl('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const res = await logLeadCall({
      leadId,
      notes: notes || undefined,
      transcript: transcript || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      outcome,
      callDate,
    })
    if (!res.ok) return feedback.setError(res.error)
    if (followUpEnabled && followUpAt) {
      await createReminder({
        leadId,
        title: `Llamar a ${leadName}`,
        remindAt: datetimeLocalToIso(followUpAt),
      })
    }
    feedback.setSuccess('Llamada registrada')
    setNotes('')
    setTranscript('')
    setDuration(defaultDurationMinutes?.toString() ?? '')
    setCallDate(todayIsoLocal())
    setFollowUpEnabled(false)
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Phone className="text-muted-foreground size-3.5" />
            Registrar llamada
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Registrar llamada</DialogTitle>
            {leadPhone && <DialogDescription>{leadPhone}</DialogDescription>}
          </DialogHeader>
          <form className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-call-outcome-${leadId}`} className="text-xs font-medium">
                  Resultado
                </Label>
                <Select
                  id={`qa-call-outcome-${leadId}`}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as CallOutcome)}
                >
                  <option value="connected">Contactado</option>
                  <option value="no_answer">Sin respuesta</option>
                  <option value="wrong_number">Número erróneo</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-call-duration-${leadId}`} className="text-xs font-medium">
                  Duración (min)
                </Label>
                <Input
                  id={`qa-call-duration-${leadId}`}
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
                id={`qa-call-date-${leadId}`}
                value={callDate}
                onChange={setCallDate}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`qa-call-notes-${leadId}`} className="text-xs font-medium">
                  Notas{' '}
                  <span className="text-muted-foreground/60">
                    (o transcripción; opcionales si no hubo contacto)
                  </span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowImport(!showImport)
                    setImportError(null)
                  }}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                >
                  <FileText className="size-3" />
                  Importar desde Meet
                </button>
              </div>
              {showImport && (
                <div className="bg-muted/30 flex flex-col gap-1.5 rounded-md border p-2">
                  <p className="text-muted-foreground text-xs">
                    Pega la URL del documento de notas de Google Meet
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://docs.google.com/document/d/…"
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={handleImportNotes}
                      disabled={importing || !importUrl.trim()}
                    >
                      {importing ? <Loader2 className="size-3 animate-spin" /> : 'Importar'}
                    </Button>
                  </div>
                  {importError && <p className="text-destructive text-xs">{importError}</p>}
                </div>
              )}
              <Textarea
                id={`qa-call-notes-${leadId}`}
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Puntos clave, próximos pasos…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-call-transcript-${leadId}`} className="text-xs font-medium">
                Transcripción <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-call-transcript-${leadId}`}
                rows={4}
                maxLength={50000}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Pega aquí la transcripción si la tienes…"
                className="font-mono text-xs"
              />
            </div>
            <FollowUpSection
              idPrefix={`qa-call-${leadId}`}
              enabled={followUpEnabled}
              onEnabledChange={setFollowUpEnabled}
              remindAt={followUpAt}
              onRemindAtChange={setFollowUpAt}
            />
            <div className="flex shrink-0 items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
              <SubmitButton loading={feedback.pending}>Registrar</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
      <LastAttemptDialog
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

export function QWhatsAppDialog({
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
  aiEnabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <MessageCircle className="size-3.5 text-emerald-600" />
          Preparar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onOverlayClick={(event) => {
          // Este diálogo se abre dentro del drawer del panel rápido. Evitamos
          // que el clic exterior cierre ambas capas y cerramos solo el diálogo.
          event.stopPropagation()
          setOpen(false)
        }}
      >
        <DialogHeader>
          <DialogTitle>Preparar WhatsApp</DialogTitle>
          <DialogDescription>
            Revisa el texto, envíalo en WhatsApp y confirma después para registrarlo.
          </DialogDescription>
        </DialogHeader>
        <WhatsAppComposer
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          senderName={senderName}
          aiEnabled={aiEnabled}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function QEmailDialog({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const feedback = useFormFeedback()
  const router = useRouter()

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const res = await logLeadEmail({
      leadId,
      direction,
      subject,
      bodyHtml: body.trim() || undefined,
      counterparty: leadEmail ?? undefined,
    })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Registrado')
    setSubject('')
    setBody('')
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <Mail className="text-muted-foreground size-3.5" />
          Registrar email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar email</DialogTitle>
          <DialogDescription>Para emails enviados o recibidos fuera de la app.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-dir-${leadId}`} className="text-xs font-medium">
              Dirección
            </Label>
            <Select
              id={`qa-email-dir-${leadId}`}
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')}
            >
              <option value="outgoing">Enviado</option>
              <option value="incoming">Recibido</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-subj-${leadId}`} className="text-xs font-medium">
              Asunto <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`qa-email-subj-${leadId}`}
              required
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-body-${leadId}`} className="text-xs font-medium">
              Cuerpo{' '}
              <span className="text-muted-foreground/60">(opcional, mejora el resumen IA)</span>
            </Label>
            <Textarea
              id={`qa-email-body-${leadId}`}
              rows={5}
              maxLength={50000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Pega o resume el contenido del email…"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Registrar</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QNoteDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const feedback = useFormFeedback()
  const router = useRouter()

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const res = await logLeadNote({ leadId, content })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Nota guardada')
    setContent('')
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <NotebookPen className="text-muted-foreground size-3.5" />
          Añadir nota
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Añadir nota</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Textarea
            rows={4}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Observaciones, contexto, próximos pasos…"
          />
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Guardar nota</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QSendEmailDialog({
  leadId,
  leadEmail,
  aiEnabled,
}: {
  leadId: string
  leadEmail: string | null
  aiEnabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSuccess() {
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <Send className="text-muted-foreground size-3.5" />
          Enviar email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar email</DialogTitle>
          {leadEmail && <DialogDescription>{leadEmail}</DialogDescription>}
        </DialogHeader>
        <EmailComposer
          leadId={leadId}
          defaultTo={leadEmail ?? ''}
          disabled={!leadEmail}
          disabledReason="Este lead no tiene email registrado."
          aiEnabled={aiEnabled}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  )
}
