'use client'

import { Eye, FileText, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MemberLabel } from '@/components/ui/member-avatar'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { getCallInteractionDetails } from '@/lib/leads/interaction-utils'
import type { LeadDetailInteraction } from '@/lib/leads/types'

import { updateLeadCall } from '../actions'
import { CallDateField } from '../call-date-field'
import { DeleteLeadInteractionButton } from './delete-lead-interaction-button'

const CALL_OUTCOME_LABEL = {
  connected: 'Contactado',
  voicemail: 'Buzón de voz',
  no_answer: 'Sin respuesta',
  busy: 'Comunicando',
  wrong_number: 'Número erróneo',
}
type CallOutcome = keyof typeof CALL_OUTCOME_LABEL

function isCallOutcome(value: string | null): value is CallOutcome {
  return value !== null && value in CALL_OUTCOME_LABEL
}

export function CallInteractionDetails({
  interaction,
  leadId,
  canEdit = false,
}: {
  interaction: LeadDetailInteraction
  leadId: string
  canEdit?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const details = getCallInteractionDetails(interaction.payload)
  const [outcome, setOutcome] = useState<CallOutcome | ''>(
    isCallOutcome(details.outcome) ? details.outcome : '',
  )
  const [duration, setDuration] = useState(details.durationMinutes?.toString() ?? '')
  const [callDate, setCallDate] = useState(details.callDate ?? interaction.created_at.slice(0, 10))
  const [notes, setNotes] = useState(interaction.body ?? '')
  const [transcript, setTranscript] = useState(details.transcript ?? '')
  const feedback = useFormFeedback()
  const router = useRouter()
  const hasNotes = Boolean(interaction.body?.trim())
  const hasTranscript = Boolean(details.transcript)
  const formattedCallDate = details.callDate
    ? new Date(`${details.callDate}T12:00:00`).toLocaleDateString('es-ES')
    : null

  const startEditing = () => {
    setOutcome(isCallOutcome(details.outcome) ? details.outcome : '')
    setDuration(details.durationMinutes?.toString() ?? '')
    setCallDate(details.callDate ?? interaction.created_at.slice(0, 10))
    setNotes(interaction.body ?? '')
    setTranscript(details.transcript ?? '')
    setEditing(true)
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    feedback.setPending()
    const result = await updateLeadCall({
      interactionId: interaction.id,
      leadId,
      notes: notes || undefined,
      transcript: transcript || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      outcome: outcome || undefined,
      callDate,
    })
    if (!result.ok) return feedback.setError(result.error)
    feedback.setSuccess('Llamada actualizada')
    setEditing(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground h-6 shrink-0 gap-1 px-2 text-xs"
        >
          <Eye className="size-3" />
          Ver detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{interaction.subject ?? 'Llamada'}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>
              {formattedCallDate
                ? `Fecha de llamada: ${formattedCallDate}`
                : new Date(interaction.created_at).toLocaleString('es-ES')}
            </span>
            {interaction.performer ? (
              <MemberLabel member={interaction.performer} size="xs" />
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <form className="min-h-0 space-y-3 overflow-y-auto pr-1" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`call-outcome-${interaction.id}`}>Resultado</Label>
                <Select
                  id={`call-outcome-${interaction.id}`}
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(isCallOutcome(event.target.value) ? event.target.value : '')
                  }
                >
                  <option value="">Sin especificar</option>
                  {Object.entries(CALL_OUTCOME_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`call-duration-${interaction.id}`}>Duración (min)</Label>
                <Input
                  id={`call-duration-${interaction.id}`}
                  type="number"
                  min={0}
                  max={600}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </div>
              <CallDateField
                id={`call-date-${interaction.id}`}
                value={callDate}
                onChange={setCallDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`call-notes-${interaction.id}`}>Notas</Label>
              <Textarea
                id={`call-notes-${interaction.id}`}
                rows={5}
                maxLength={8000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`call-transcript-${interaction.id}`}>Transcripción</Label>
              <Textarea
                id={`call-transcript-${interaction.id}`}
                rows={4}
                maxLength={50000}
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <SubmitButton loading={feedback.pending}>Guardar cambios</SubmitButton>
            </div>
          </form>
        ) : (
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              {details.outcome ? (
                <Badge variant="neutral">
                  {isCallOutcome(details.outcome)
                    ? CALL_OUTCOME_LABEL[details.outcome]
                    : details.outcome}
                </Badge>
              ) : null}
              {details.durationMinutes != null ? (
                <Badge variant="outline">{details.durationMinutes} min</Badge>
              ) : null}
            </div>

            {hasNotes ? (
              <section className="space-y-1.5">
                <h3 className="text-muted-foreground text-xs font-medium">Notas</h3>
                <p className="bg-muted/30 rounded-md border p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {interaction.body}
                </p>
              </section>
            ) : null}

            {hasTranscript ? (
              <section className="space-y-1.5">
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <FileText className="size-3.5" />
                  Transcripción completa
                </h3>
                <p className="bg-muted/30 max-h-[50vh] overflow-y-auto rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {details.transcript}
                </p>
              </section>
            ) : null}

            {!hasNotes && !hasTranscript ? (
              <p className="text-muted-foreground text-sm">
                Esta llamada no tiene notas ni transcripción.
              </p>
            ) : null}
            {canEdit ? (
              <div className="flex justify-end gap-1 border-t pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={startEditing}>
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
                <DeleteLeadInteractionButton
                  leadId={leadId}
                  interactionId={interaction.id}
                  label="llamada"
                />
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
