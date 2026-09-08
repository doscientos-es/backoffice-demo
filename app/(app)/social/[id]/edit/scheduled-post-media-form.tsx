'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { FormRow } from '@/components/ui/form-row'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import type { MediaItem } from '@/lib/social/core'
import { datetimeLocalToIso, toDatetimeLocalValue } from '@/lib/utils/date-time'

import { updateScheduledPost } from '../../actions'
import { MediaPicker } from '../../compose/_components/media-picker'

export function ScheduledPostForm({
  postId,
  initialCaption,
  initialMedia,
  initialScheduledAt,
}: {
  postId: string
  initialCaption: string
  initialMedia: MediaItem[]
  initialScheduledAt: string
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [pending, startTransition] = useTransition()
  const [caption, setCaption] = useState(initialCaption)
  const [media, setMedia] = useState(initialMedia)
  const [scheduledLocal, setScheduledLocal] = useState(() =>
    toDatetimeLocalValue(new Date(initialScheduledAt)),
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!scheduledLocal) {
      feedback.setError('Indica la fecha y hora de publicación')
      return
    }
    feedback.setPending()
    startTransition(async () => {
      const result = await updateScheduledPost({
        postId,
        caption,
        media,
        scheduledAt: datetimeLocalToIso(scheduledLocal),
      })
      if (!result.ok) return feedback.setError(result.error)
      router.push(`/social/${postId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <FormRow
            label="Texto"
            htmlFor="caption"
            hint="Se aplicará como copy común de la publicación."
          >
            <div className="flex flex-col gap-1.5">
              <Textarea
                id="caption"
                rows={6}
                maxLength={3000}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                disabled={pending}
                autoFocus
              />
              <span className="text-muted-foreground self-end text-[11px] tabular-nums">
                {caption.length}/3000
              </span>
            </div>
          </FormRow>
          <FormRow label="Imagen" htmlFor="media" hint="Imágenes o vídeo. Máximo 10 archivos.">
            <div id="media">
              <MediaPicker value={media} onChange={setMedia} disabled={pending} />
            </div>
          </FormRow>
          <FormRow label="Fecha y hora" htmlFor="scheduledAt" required>
            <input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledLocal}
              min={toDatetimeLocalValue(new Date())}
              onChange={(event) => setScheduledLocal(event.target.value)}
              disabled={pending}
              className="border-border focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-border/30 w-full max-w-xs rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </FormRow>
        </CardContent>
      </Card>
      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/social/${postId}`}>Cancelar</Link>
        </Button>
        <SubmitButton loading={pending} pendingLabel="Guardando…">
          Guardar cambios
        </SubmitButton>
      </div>
    </form>
  )
}
