'use client'

import { Check, LoaderCircle as Loader2, MessageCircle, Sparkle as Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { AiNotice } from '@/components/ui/ai-notice'
import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { publicEnv } from '@/lib/env'
import { buildLeadWhatsAppMessage, buildWhatsAppUrl } from '@/lib/leads/whatsapp'

import { logLeadWhatsApp } from './actions'

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'ca', label: 'Català' },
  { value: 'en', label: 'English' },
] as const

type Props = {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  aiEnabled?: boolean
  defaultMessage?: string
  draftKind?: string
  draftInstructions?: string
  onSuccess?: () => void
}

function signedMessage(message: string, senderName: string): string {
  const signature = senderName.trim() ? `— ${senderName.trim()}` : ''
  if (!signature || message.trimEnd().endsWith(signature)) return message
  return `${message.trim()}\n\n${signature}`
}

export function WhatsAppComposer({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  senderName,
  aiEnabled,
  defaultMessage,
  draftKind = 'follow_up',
  draftInstructions,
  onSuccess,
}: Props) {
  const fallbackMessage = buildLeadWhatsAppMessage(
    { id: leadId, name: leadName, email: leadEmail },
    senderName,
    publicEnv.NEXT_PUBLIC_CAL_LINK,
  )
  const initialMessage = signedMessage(defaultMessage ?? fallbackMessage, senderName)
  const [message, setMessage] = useState(initialMessage)
  const [language, setLanguage] = useState('es')
  const [drafting, setDrafting] = useState(false)
  const [openedMessage, setOpenedMessage] = useState<string | null>(null)
  const feedback = useFormFeedback()
  const router = useRouter()

  if (!leadPhone) {
    return (
      <div className="border-border text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        Este lead no tiene teléfono registrado.
      </div>
    )
  }

  async function handleDraftWithAI() {
    setDrafting(true)
    setOpenedMessage(null)
    try {
      const response = await fetch('/api/crm/ai/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          kind: draftKind,
          channel: 'whatsapp',
          language,
          instructions: draftInstructions,
        }),
      })
      const json = (await response.json()) as { body?: string; error?: string }
      if (!response.ok || !json.body) {
        throw new Error(json.error ?? 'No se pudo generar el borrador.')
      }
      setMessage(signedMessage(json.body, senderName))
    } catch (reason) {
      feedback.setError(reason instanceof Error ? reason.message : 'Error al generar el borrador.')
    } finally {
      setDrafting(false)
    }
  }

  async function handleConfirmSent() {
    if (!openedMessage) return
    feedback.setPending()
    const result = await logLeadWhatsApp({ leadId, content: openedMessage })
    if (!result.ok) return feedback.setError(result.error)
    feedback.setSuccess('WhatsApp registrado')
    setOpenedMessage(null)
    setMessage(initialMessage)
    router.refresh()
    onSuccess?.()
  }

  const href = buildWhatsAppUrl(leadPhone, message)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {aiEnabled ? (
          <div className="flex items-center gap-2">
            <Select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              disabled={drafting}
              className="h-8 w-auto py-0 text-xs"
              aria-label="Idioma del WhatsApp"
            >
              {LANGUAGES.map((option) => (
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
            >
              {drafting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {drafting ? 'Generando…' : 'Generar borrador'}
            </Button>
          </div>
        ) : (
          <AiNotice inline />
        )}
        <span className="text-muted-foreground text-xs">Firma: {senderName || 'equipo'}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`whatsapp-message-${leadId}`} className="text-xs font-medium">
          Mensaje
        </Label>
        <Textarea
          id={`whatsapp-message-${leadId}`}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            setOpenedMessage(null)
          }}
          rows={8}
          required
          maxLength={8000}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={feedback.state} pendingLabel="Registrando…" />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" disabled={!message.trim()}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpenedMessage(message)}
            >
              <MessageCircle className="size-4 text-emerald-600" />
              Abrir WhatsApp
            </a>
          </Button>
          {openedMessage ? (
            <Button type="button" onClick={handleConfirmSent} disabled={feedback.pending}>
              <Check className="size-4" />
              Confirmar enviado
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        WhatsApp no informa al backoffice del envío. Confirma solo después de enviarlo en la app.
      </p>
    </div>
  )
}
