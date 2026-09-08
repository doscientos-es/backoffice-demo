'use client'

import { LoaderCircle as Loader2, Sparkle as Sparkles } from 'lucide-react'
import { useId, useState } from 'react'

import { AiNotice } from '@/components/ui/ai-notice'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'

import { sendEmailToLead } from '../actions'

/** Idiomas soportados para el borrador generado por IA. */
const EMAIL_LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'ca', label: 'Català' },
  { value: 'en', label: 'English' },
] as const

const MAX_DRAFT_INSTRUCTIONS = 1000

export type EmailComposerProps = {
  leadId: string
  defaultTo: string
  /** Pre-fills the subject line (e.g. a reason-based recovery template). */
  defaultSubject?: string
  /** Pre-fills the Markdown body. */
  defaultBody?: string
  /** Kind and extra instructions sent to the optional AI drafting endpoint. */
  draftKind?: string
  draftInstructions?: string
  /** Interaction loaded server-side as the complete source for a contextual reply. */
  draftInteractionId?: string
  /** Sends a copy to active owners and admins. Used for post-call summaries. */
  ccAdmins?: boolean
  disabled?: boolean
  disabledReason?: string
  aiEnabled?: boolean
  onSuccess?: () => void
}

export function EmailComposer({
  leadId,
  defaultTo,
  defaultSubject,
  defaultBody,
  draftKind = 'follow_up',
  draftInstructions,
  draftInteractionId,
  ccAdmins = false,
  disabled,
  disabledReason,
  aiEnabled,
  onSuccess,
}: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject ?? '')
  const [body, setBody] = useState(defaultBody ?? '')
  const [language, setLanguage] = useState<string>('es')
  const [aiInstructions, setAiInstructions] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const instructionsId = useId()
  const languageId = useId()
  const feedback = useFormFeedback()
  const baseDraftInstructions = draftInstructions?.trim() ?? ''
  const instructionSeparatorLength = baseDraftInstructions ? 2 : 0
  const customInstructionLimit = Math.max(
    0,
    MAX_DRAFT_INSTRUCTIONS - baseDraftInstructions.length - instructionSeparatorLength,
  )

  async function handleDraftWithAI() {
    setDrafting(true)
    try {
      const res = await fetch('/api/crm/ai/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          kind: draftKind,
          reply_to_interaction_id: draftInteractionId,
          instructions:
            [baseDraftInstructions, aiInstructions.trim()].filter(Boolean).join('\n\n') ||
            undefined,
          language,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al generar el borrador.')
      setSubject(json.subject ?? '')
      setBody(json.body ?? '')
      setHasGeneratedDraft(true)
    } catch (err) {
      feedback.setError(err instanceof Error ? err.message : 'Error al generar el borrador.')
    } finally {
      setDrafting(false)
    }
  }

  if (disabled) {
    return (
      <div className="border-border text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        {disabledReason ?? 'Envío de email no disponible.'}
      </div>
    )
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!to || !subject || !body) {
      feedback.setError('Completa destinatario, asunto y cuerpo.')
      return
    }
    setConfirmOpen(true)
  }

  async function handleConfirmSend() {
    feedback.setPending()
    const res = await sendEmailToLead({
      leadId,
      to,
      subject,
      bodyHtml: body,
      includeSignature: true,
      ccAdmins,
    })
    if (res.ok) {
      setConfirmOpen(false)
      feedback.setSuccess(res.mocked ? 'Email simulado (modo dev)' : 'Email enviado')
      setSubject('')
      setBody('')
      onSuccess?.()
    } else {
      setConfirmOpen(false)
      feedback.setError(res.error)
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {aiEnabled ? (
          <div className="border-primary/20 bg-primary/[0.03] rounded-lg border p-3">
            <div className="flex items-start gap-2.5">
              <div className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
                <Sparkles className="size-3.5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Crear borrador con IA</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Describe el objetivo, los puntos clave o el tono. Podrás editarlo antes de enviar.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor={instructionsId} className="text-xs font-medium">
                ¿Qué quieres que diga el email?{' '}
                <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id={instructionsId}
                value={aiInstructions}
                onChange={(event) => setAiInstructions(event.target.value)}
                disabled={drafting || customInstructionLimit === 0}
                rows={3}
                maxLength={customInstructionLimit}
                placeholder="Ej.: resume los dos beneficios principales, usa un tono breve y cercano y termina proponiendo una llamada de 20 minutos."
                aria-describedby={`${instructionsId}-hint`}
              />
              <div
                id={`${instructionsId}-hint`}
                className="text-muted-foreground flex items-center justify-between gap-3 text-[11px]"
              >
                <span>La IA usará también el contexto y el historial del lead.</span>
                <span className="shrink-0 tabular-nums">
                  {aiInstructions.length}/{customInstructionLimit}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <Label htmlFor={languageId} className="sr-only">
                Idioma del email
              </Label>
              <Select
                id={languageId}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={drafting}
                className="h-8 w-auto py-0 text-xs"
                aria-label="Idioma del email"
              >
                {EMAIL_LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDraftWithAI}
                disabled={drafting}
                className="gap-1.5"
              >
                {drafting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                {drafting
                  ? 'Generando…'
                  : hasGeneratedDraft
                    ? 'Regenerar borrador'
                    : 'Generar borrador'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <AiNotice inline />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to" className="text-xs font-medium">
            Para <span className="text-destructive">*</span>
          </Label>
          <Input
            id="to"
            type="email"
            inputMode="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            placeholder="destinatario@empresa.com"
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject" className="text-xs font-medium">
            Asunto <span className="text-destructive">*</span>
          </Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Hola {{nombre}}, …"
            required
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="body" className="text-xs font-medium">
            Mensaje (Markdown) <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={'Hola **{{nombre}}**,\n\n…'}
            required
            className="font-mono text-xs"
            aria-describedby="body-hint"
          />
          <p id="body-hint" className="text-muted-foreground text-[11px]">
            Se escribe en Markdown. Variables disponibles: <code>{'{{nombre}}'}</code>,{' '}
            <code>{'{{empresa}}'}</code>, <code>{'{{email}}'}</code>. Tu firma se añade al final.
          </p>
        </div>
        <p className="text-foreground rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          Este mensaje llegará a <strong>{to || 'la dirección indicada'}</strong>. Antes de enviarlo
          podrás revisar una confirmación final.
        </p>
        <div className="flex items-center justify-end gap-3">
          <FormFeedback
            state={feedback.state}
            pendingLabel="Enviando…"
            successLabel="Email enviado"
          />
          <SubmitButton pendingLabel="Preparando…" loading={feedback.pending}>
            Revisar y enviar
          </SubmitButton>
        </div>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Enviar este email al lead?"
        description={
          <>
            <p>
              Se enviará un email real a <strong>{to}</strong>.
            </p>
            <p className="mt-2">
              <strong>Asunto:</strong> {subject}
            </p>
            <p className="mt-2">El lead recibirá el contenido que acabas de revisar.</p>
          </>
        }
        confirmLabel="Sí, enviar email"
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmSend()}
      />
    </>
  )
}
