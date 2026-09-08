import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { requirePageRole } from '@/lib/auth'
import { getPost } from '@/lib/social/repo'

import { ScheduledPostForm } from './scheduled-post-media-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Editar publicación · Social' }

export default async function EditScheduledPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePageRole(['owner', 'admin', 'member'])
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()
  if (post.status !== 'scheduled' || !post.scheduledAt) redirect(`/social/${id}`)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Editar publicación programada"
        description="Actualiza el texto, la imagen o la fecha antes de publicar."
        back={<BackLink href={`/social/${id}`} label="Volver al detalle" />}
      />
      <ScheduledPostForm
        postId={post.id}
        initialCaption={post.caption}
        initialMedia={post.media}
        initialScheduledAt={post.scheduledAt}
      />
    </div>
  )
}
