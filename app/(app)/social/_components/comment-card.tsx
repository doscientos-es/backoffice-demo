'use client'

import { Heart, MessageSquare, Undo2 as Reply } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Textarea } from '@/components/ui/textarea'
import type { CommentView } from '@/lib/social/types'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'

import { replyToComment } from '../actions'
import { PlatformChip } from './platform'

/**
 * Unified comment inbox item. Shows the original comment, platform info,
 * the post it belongs to, and an expandable reply form.
 */
export function CommentCard({
  comment,
  showPostContext = true,
}: {
  comment: CommentView
  showPostContext?: boolean
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const { state, setPending, setSuccess, setError, pending } = useFormFeedback()

  async function handleReply() {
    if (!replyText.trim()) return
    setPending()
    const res = await replyToComment({
      commentId: comment.id,
      message: replyText,
    })
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSuccess('Respuesta enviada')
    setReplyText('')
    setTimeout(() => setShowReply(false), 2000)
  }

  return (
    <Card className={cn('overflow-hidden', comment.replied && 'bg-muted/30 opacity-80')}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 text-sm font-semibold break-words">{comment.authorName}</span>
            <PlatformChip platform={comment.platform} />
          </div>
          <time
            className="text-muted-foreground text-[10px] uppercase"
            title={formatDateTime(comment.publishedAt)}
          >
            {relativeTime(comment.publishedAt)}
          </time>
        </div>
        {comment.replied && (
          <span className="bg-success/10 text-success ring-success/20 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1">
            Respondido
          </span>
        )}
      </CardHeader>
      <CardContent className="min-w-0 p-4 pt-0">
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{comment.text}</p>

        {showPostContext ? <PostContext comment={comment} /> : null}
      </CardContent>
      <CardFooter className="border-border/50 bg-muted/5 flex flex-col items-stretch border-t p-2 px-4">
        <div className="flex items-center justify-between py-1">
          <div className="text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs">
              <Heart className="size-3" />
              {comment.likeCount}
            </span>
          </div>
          {!comment.replied && !showReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowReply(true)}
            >
              <Reply className="size-3.5" />
              Responder
            </Button>
          )}
        </div>

        {showReply && (
          <div className="animate-in slide-in-from-top-1 flex flex-col gap-2 pt-2 pb-1 duration-200">
            <Textarea
              placeholder="Escribe tu respuesta pública..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              disabled={pending}
              autoFocus
            />
            <div className="flex items-center justify-between gap-4">
              <FormFeedback state={state} />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReply(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleReply} disabled={pending || !replyText.trim()}>
                  {pending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

function PostContext({ comment }: { comment: CommentView }) {
  const content = (
    <>
      <MessageSquare className="mt-0.5 size-3 shrink-0" />
      <span className="shrink-0 font-medium">En post:</span>
      <span
        className="line-clamp-2 min-w-0 flex-1 break-words italic"
        title={comment.postCaption || '(Sin texto)'}
      >
        "{comment.postCaption || '(Sin texto)'}"
      </span>
    </>
  )
  const className =
    'mt-3 flex min-w-0 items-start gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground'

  if (!comment.postId) return <div className={className}>{content}</div>
  return (
    <Link
      href={`/social/${comment.postId}`}
      className={cn(className, 'hover:border-border hover:bg-muted/40')}
    >
      {content}
    </Link>
  )
}
