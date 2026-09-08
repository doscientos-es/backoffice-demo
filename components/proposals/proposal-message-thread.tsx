'use client'

import { MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export type ProposalMessage = {
  id: string
  author_type: 'client' | 'team'
  author_name: string
  body: string
  created_at: string
}

type Result = { ok: true } | { ok: false; error: string }

export function ProposalMessageThread({
  messages,
  submit,
  disabled = false,
  sticky = true,
}: {
  messages: ProposalMessage[]
  submit: (body: string) => Promise<Result>
  disabled?: boolean
  sticky?: boolean
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: { preventDefault(): void }) {
    event.preventDefault()
    const text = body.trim()
    if (!text || pending) return
    setPending(true)
    setError(null)
    const result = await submit(text)
    setPending(false)
    if (!result.ok) return setError(result.error)
    setBody('')
    router.refresh()
  }

  return (
    <aside
      className={`rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 ${sticky ? 'lg:sticky lg:top-6' : ''}`}
    >
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-[#2A4227] dark:text-[#9CC196]" />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Consultas</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        ¿Tienes alguna duda o quieres proponer un cambio? Escríbenos aquí.
      </p>
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Aún no hay consultas.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${message.author_type === 'team' ? 'bg-[#2A4227]/5 text-zinc-700 dark:bg-[#9CC196]/10 dark:text-zinc-200' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}
            >
              <p className="mb-1 font-semibold">{message.author_name}</p>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </div>
          ))
        )}
      </div>
      {!disabled ? (
        <form
          className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"
          onSubmit={onSubmit}
        >
          <Textarea
            aria-label="Escribe tu consulta"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Escribe tu pregunta…"
            maxLength={2000}
            rows={3}
          />
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <Button type="submit" size="sm" className="w-full" disabled={pending || !body.trim()}>
            {pending ? 'Enviando…' : 'Enviar consulta'}
          </Button>
        </form>
      ) : null}
    </aside>
  )
}
