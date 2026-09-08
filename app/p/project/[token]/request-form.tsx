'use client'

import { MessageSquarePlus, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { submitProjectRequest } from './actions'

export function ProjectRequestDialog({ token }: { token: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <MessageSquarePlus className="size-3.5" aria-hidden="true" />
          Nueva
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg">Nueva solicitud</DialogTitle>
          <DialogDescription>
            Cuéntanos qué necesitas y quedará registrado en el proyecto.
          </DialogDescription>
        </DialogHeader>
        <ProjectRequestForm token={token} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

export function ProjectRequestForm({
  token,
  onSuccess,
}: {
  token: string
  onSuccess?: () => void
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    setSent(false)
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await submitProjectRequest({
        token,
        category: data.get('category')?.toString(),
        subject: data.get('subject')?.toString(),
        body: data.get('body')?.toString(),
        requesterName: data.get('requester_name')?.toString(),
        requesterEmail: data.get('requester_email')?.toString(),
        website: data.get('website')?.toString(),
      })
      if (!result.ok) return feedback.setError(result.error)
      form.reset()
      setSent(true)
      feedback.setSuccess('Solicitud enviada correctamente')
      router.refresh()
      onSuccess?.()
    } catch {
      feedback.setError('No se pudo enviar. Comprueba tu conexión e inténtalo de nuevo.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" aria-label="Nueva solicitud">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="requester-name" className="mb-1.5 block text-sm font-medium">
            Nombre
          </label>
          <Input
            id="requester-name"
            name="requester_name"
            required
            maxLength={160}
            autoComplete="name"
            placeholder="Tu nombre"
            className="h-10 bg-white dark:bg-white/[0.04]"
          />
        </div>
        <div>
          <label htmlFor="requester-email" className="mb-1.5 block text-sm font-medium">
            Email <span className="font-normal text-zinc-400">(opcional)</span>
          </label>
          <Input
            id="requester-email"
            name="requester_email"
            type="email"
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            placeholder="nombre@empresa.com"
            className="h-10 bg-white dark:bg-white/[0.04]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="request-category" className="mb-1.5 block text-sm font-medium">
          ¿En qué podemos ayudarte?
        </label>
        <Select
          id="request-category"
          name="category"
          defaultValue="question"
          className="h-10 bg-white dark:bg-white/[0.04]"
        >
          <option value="question">Tengo una consulta</option>
          <option value="incident">Quiero comunicar una incidencia</option>
          <option value="change">Necesito solicitar un cambio</option>
          <option value="material">Quiero entregar material</option>
          <option value="maintenance">Necesito mantenimiento</option>
          <option value="complaint">Quiero presentar una queja</option>
        </Select>
      </div>
      <div>
        <label htmlFor="request-subject" className="mb-1.5 block text-sm font-medium">
          Asunto
        </label>
        <Input
          id="request-subject"
          name="subject"
          required
          maxLength={160}
          placeholder="Resume brevemente tu solicitud"
          className="h-10 bg-white dark:bg-white/[0.04]"
        />
      </div>
      <div>
        <label htmlFor="request-body" className="mb-1.5 block text-sm font-medium">
          Descripción
        </label>
        <Textarea
          id="request-body"
          name="body"
          required
          rows={5}
          maxLength={4000}
          placeholder="Incluye el contexto y todos los detalles que consideres útiles…"
          className="min-h-32 resize-y bg-white dark:bg-white/[0.04]"
        />
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="request-website">Website</label>
        <input id="request-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          <FormFeedback state={feedback.state} />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={feedback.pending}
          aria-busy={feedback.pending}
          className="h-10 rounded-xl px-4"
        >
          {feedback.pending ? 'Enviando…' : sent ? 'Enviar otra solicitud' : 'Enviar solicitud'}
          <Send className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}
