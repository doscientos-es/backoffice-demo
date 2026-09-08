'use client'

import { CalendarDays, CornerUpLeft, Eye, Mail, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MemberLabel } from '@/components/ui/member-avatar'
import { interactionBodyText } from '@/lib/leads/interaction-utils'
import type { LeadDetailInteraction } from '@/lib/leads/types'

import { EmailComposer } from './email-composer'

function payloadText(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = (payload as Record<string, unknown>)[key]
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    return items.length ? items.join(', ') : null
  }
  return null
}

function emailMetadata(payload: unknown): Array<[string, string]> {
  const metadata: Array<[string, string]> = []
  const fields = [
    ['De', 'from'],
    ['Para', 'to'],
    ['CC', 'cc'],
    ['Contacto', 'counterparty'],
  ] as const

  for (const [label, key] of fields) {
    const value = payloadText(payload, key)
    if (value) metadata.push([label, value])
  }
  return metadata
}

function emailAddress(value: string | null): string | null {
  if (!value) return null
  return (
    value.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ??
    value.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ??
    null
  )
}

function replySubject(subject: string | null): string {
  if (!subject) return 'Re: '
  return /^(re|aw|sv):/i.test(subject.trim()) ? subject : `Re: ${subject}`
}

export function LeadInteractionDetails({
  interaction,
  label,
  leadId,
  leadEmail,
  canReply = false,
  aiEnabled = false,
}: {
  interaction: LeadDetailInteraction
  label: string
  leadId: string
  leadEmail: string | null
  canReply?: boolean
  aiEnabled?: boolean
}) {
  const [replying, setReplying] = useState(false)
  const router = useRouter()
  const body = interactionBodyText(interaction.body)
  const isEmail = interaction.type.startsWith('email_')
  const metadata = isEmail ? emailMetadata(interaction.payload) : []
  const replyTo =
    emailAddress(payloadText(interaction.payload, 'from')) ??
    emailAddress(payloadText(interaction.payload, 'counterparty')) ??
    leadEmail
  const canQuickReply = interaction.type === 'email_received' && canReply

  if (!body) return null

  return (
    <Dialog>
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
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="from-primary/[0.07] via-background to-background shrink-0 border-b bg-gradient-to-br p-5 pr-12 sm:p-6 sm:pr-14">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary ring-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
              {isEmail ? <Mail className="size-5" /> : <Eye className="size-5" />}
            </span>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{label}</Badge>
                {canQuickReply ? <Badge variant="neutral">Respuesta disponible</Badge> : null}
              </div>
              <DialogTitle className="text-left text-lg leading-snug sm:text-xl">
                {interaction.subject ?? label}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-left">
                <CalendarDays className="size-3.5" />
                <span>{new Date(interaction.created_at).toLocaleString('es-ES')}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-5">
              {replying ? (
                <section className="border-primary/20 bg-card rounded-xl border p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <CornerUpLeft className="text-primary size-4" />
                        Respuesta rápida
                      </h3>
                      <p className="text-muted-foreground mt-1 text-xs">
                        La IA usará el mensaje completo como fuente prioritaria. Revisa siempre el
                        borrador.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplying(false)}
                    >
                      Cerrar
                    </Button>
                  </div>
                  <EmailComposer
                    key={interaction.id}
                    leadId={leadId}
                    defaultTo={replyTo ?? ''}
                    defaultSubject={replySubject(interaction.subject)}
                    draftKind="reply"
                    draftInteractionId={interaction.id}
                    draftInstructions="Responde directamente al mensaje recibido, cubre sus preguntas y mantén un tono claro, cercano y útil."
                    disabled={!replyTo}
                    disabledReason="No se ha podido identificar una dirección de respuesta."
                    aiEnabled={aiEnabled}
                    onSuccess={() => router.refresh()}
                  />
                </section>
              ) : null}

              <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
                <div className="bg-muted/20 flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <h3 className="text-sm font-medium">Contenido completo</h3>
                    <p className="text-muted-foreground text-xs">
                      Formato original convertido a texto legible.
                    </p>
                  </div>
                  <CopyButton text={body} label="Copiar contenido" showLabel className="shrink-0" />
                </div>
                <p className="p-4 text-sm leading-7 break-words whitespace-pre-wrap sm:p-5">
                  {body}
                </p>
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-0">
              <section className="bg-muted/15 rounded-xl border p-4">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Detalles
                </h3>
                <dl className="mt-3 space-y-3 text-sm">
                  {metadata.map(([name, value]) => (
                    <div key={name}>
                      <dt className="text-muted-foreground text-xs">{name}</dt>
                      <dd className="mt-0.5 leading-snug font-medium break-words">{value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-muted-foreground text-xs">Registrado por</dt>
                    <dd className="mt-1">
                      {interaction.performer ? (
                        <MemberLabel member={interaction.performer} size="xs" />
                      ) : (
                        <span className="font-medium">Sincronización automática</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              {canQuickReply ? (
                <section className="border-primary/20 bg-primary/[0.04] rounded-xl border p-4">
                  <Sparkles className="text-primary size-5" />
                  <h3 className="mt-3 text-sm font-semibold">Preparar respuesta</h3>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Responde manualmente o genera un borrador contextual con IA usando todo el
                    email.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full gap-2"
                    onClick={() => setReplying((value) => !value)}
                  >
                    <CornerUpLeft className="size-4" />
                    {replying ? 'Ocultar respuesta' : 'Responder'}
                  </Button>
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
