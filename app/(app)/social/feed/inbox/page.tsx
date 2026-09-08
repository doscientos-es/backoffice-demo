import { MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty-state'
import { SectionBoundary } from '@/components/ui/error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { requireUser } from '@/lib/auth'
import { listComments } from '@/lib/social/repo'

import { CommentCard } from '../../_components/comment-card'
import { SyncButton } from '../../_components/sync-button'

export const metadata: Metadata = { title: 'Bandeja de entrada · Social · doscientos' }
export const dynamic = 'force-dynamic'

async function CommentsList() {
  const comments = await listComments()
  if (comments.length === 0) {
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquare />
          </EmptyMedia>
          <EmptyTitle>Bandeja vacía</EmptyTitle>
          <EmptyDescription>
            Sincroniza tus redes para ver los últimos comentarios de tus publicaciones.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} />
      ))}
    </div>
  )
}

function InboxSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
        <div key={i} className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export default async function InboxPage() {
  await requireUser()
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/social" label="Social" />
      <PageHeader
        title="Bandeja de entrada"
        description="Gestiona todos los comentarios de Instagram y Facebook en un solo sitio."
        actions={<SyncButton kind="comments" label="Sincronizar" />}
      />
      <SectionBoundary pending={<InboxSkeleton />} label="No se pudieron cargar los comentarios">
        <CommentsList />
      </SectionBoundary>
    </div>
  )
}
