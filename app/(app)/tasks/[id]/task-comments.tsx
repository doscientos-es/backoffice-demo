'use client'

import { Send, Trash as Trash2 } from 'lucide-react'
import { useCallback, useEffect, useOptimistic, useState, useTransition } from 'react'

import { addComment, deleteComment } from '@/app/(app)/tasks/comment-actions'
import { Button } from '@/components/ui/button'
import { MemberAvatar } from '@/components/ui/member-avatar'
import { Textarea } from '@/components/ui/textarea'
import { getBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'

export type CommentAuthor = {
  id: string
  name: string
  avatar_url: string | null
  github_handle: string | null
}

export type CommentItem = {
  id: string
  body: string
  created_at: string
  author: CommentAuthor | null
}

type Props = {
  taskId: string
  currentMember: CommentAuthor
  memberRole: string
  initialComments: CommentItem[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Highlight @mentions in rendered body
function renderBody(body: string, ownComment: boolean) {
  const mentionClassName = ownComment
    ? 'font-semibold underline decoration-current/40'
    : 'font-medium text-primary'
  return body.split(/(@[\w.-]+)/g).map((part, i) =>
    part.startsWith('@') ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are recomputed from the string on every render
      <span key={i} className={mentionClassName}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}

export function TaskComments({ taskId, currentMember, memberRole, initialComments }: Props) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments)
  const [optimistic, addOptimistic] = useOptimistic(comments, (state, c: CommentItem) => [
    ...state,
    c,
  ])
  const [body, setBody] = useState('')
  const [, startTransition] = useTransition()

  const fetchComments = useCallback(async () => {
    const supabase = getBrowserClient()
    const { data } = await supabase
      .from('task_comments')
      .select('id, body, created_at, author:author_id(id, name, avatar_url, github_handle)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    if (data) setComments(data as unknown as CommentItem[])
  }, [taskId])

  useEffect(() => {
    const supabase = getBrowserClient()
    const ch = supabase
      .channel(`comments-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        () => fetchComments(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [taskId, fetchComments])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    const optimisticComment: CommentItem = {
      id: `opt-${Date.now()}`,
      body: trimmed,
      created_at: new Date().toISOString(),
      author: currentMember,
    }
    setBody('')
    startTransition(async () => {
      addOptimistic(optimisticComment)
      await addComment({ taskId, body: trimmed })
      await fetchComments()
    })
  }

  const canDelete = (authorId: string) =>
    authorId === currentMember.id || memberRole === 'owner' || memberRole === 'admin'

  return (
    <div className="flex flex-col gap-3">
      {optimistic.length === 0 ? (
        <p className="text-muted-foreground py-2 text-xs">Sin comentarios todavía.</p>
      ) : (
        <ul aria-label="Chat de comentarios" className="flex flex-col gap-3 py-1">
          {optimistic.map((c) => {
            const ownComment = c.author?.id === currentMember.id
            return (
              <li
                key={c.id}
                className={`flex items-end gap-2 ${ownComment ? 'justify-end' : 'justify-start'}`}
              >
                {!ownComment ? (
                  <MemberAvatar member={c.author} size="sm" className="shrink-0" />
                ) : null}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[75%]',
                    ownComment
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-muted text-foreground',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold">
                      {ownComment ? 'Tú' : (c.author?.name ?? 'Miembro eliminado')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <time
                        dateTime={c.created_at}
                        className={`text-[10px] ${ownComment ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                      >
                        {fmtDate(c.created_at)}
                      </time>
                      {c.author?.id && canDelete(c.author.id) && !c.id.startsWith('opt-') ? (
                        <button
                          type="button"
                          title="Eliminar comentario"
                          aria-label="Eliminar comentario"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteComment({ commentId: c.id, taskId })
                              await fetchComments()
                            })
                          }
                          className={cn(
                            'rounded-sm transition-colors',
                            ownComment
                              ? 'text-primary-foreground/60 hover:text-primary-foreground'
                              : 'text-muted-foreground hover:text-destructive',
                          )}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {renderBody(c.body, ownComment)}
                  </p>
                </div>
                {ownComment ? (
                  <MemberAvatar member={c.author} size="sm" className="shrink-0" />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-border bg-background focus-within:ring-ring/40 rounded-2xl border p-2 shadow-sm transition-shadow focus-within:ring-2"
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un comentario… usa @nombre para mencionar"
          aria-label="Nuevo comentario"
          rows={2}
          className="min-h-14 resize-none border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
          }}
        />
        <div className="mt-1 flex items-center justify-between pl-2">
          <span className="text-muted-foreground text-[11px]">Ctrl/⌘ + Intro para enviar</span>
          <Button type="submit" size="sm" disabled={!body.trim()}>
            <Send data-icon="inline-start" />
            Enviar
          </Button>
        </div>
      </form>
    </div>
  )
}
