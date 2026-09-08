/**
 * Social Hub — Instagram Publisher (adapter).
 *
 * Implements the core Publisher port for the IG Business account by composing
 * the low-level operations in instagram-api.ts. Encapsulates IG's rules: no
 * text-only posts, single video published as a Reel, 2–10 items per carousel,
 * and the container→(poll)→publish protocol.
 */
import { scopedLogger } from '@/lib/logger'
import type {
  ComposedPost,
  PlatformComment,
  PostInsights,
  Publisher,
  PublishOutcome,
  PublishSupport,
  SocialPlatform,
} from '@/lib/social/core'
import { PublishError } from '@/lib/social/core'

import { metaPageToken } from './graph-client'
import {
  createCarouselChild,
  createCarouselContainer,
  createPhotoContainer,
  createVideoContainer,
  deleteMedia,
  getMediaComments,
  getMediaInsights,
  getPermalink,
  igUserId,
  publishContainer,
  replyToComment,
  waitForContainer,
} from './instagram-api'

const log = scopedLogger('social-instagram')

const MAX_CAROUSEL = 10
const MIN_CAROUSEL = 2

export class InstagramPublisher implements Publisher {
  readonly platform: SocialPlatform = 'instagram'

  isConfigured(): boolean {
    return Boolean(metaPageToken() && igUserId())
  }

  supports(post: ComposedPost): PublishSupport {
    if (post.mediaKind === 'text' || post.media.length === 0) {
      return { ok: false, reason: 'Instagram requiere al menos una imagen o vídeo.' }
    }
    if (post.mediaKind === 'carousel') {
      if (post.media.length < MIN_CAROUSEL || post.media.length > MAX_CAROUSEL) {
        return {
          ok: false,
          reason: `El carrusel admite entre ${MIN_CAROUSEL} y ${MAX_CAROUSEL} elementos.`,
        }
      }
    }
    return { ok: true }
  }

  async publish(post: ComposedPost): Promise<PublishOutcome> {
    const creationId = await this.createContainer(post)
    const published = await publishContainer(creationId)
    const remoteUrl = await getPermalink(published.id).catch(() => null)
    log.info({ postId: post.id, mediaId: published.id }, 'Published to Instagram')
    return { remoteId: published.id, remoteUrl }
  }

  private async createContainer(post: ComposedPost): Promise<string> {
    switch (post.mediaKind) {
      case 'photo': {
        const item = post.media[0]
        if (!item) throw new PublishError('instagram', 'Falta la imagen.')
        const container = await createPhotoContainer(item.publicUrl, post.caption)
        // Photos are usually ready in <2 s but Instagram occasionally needs a moment
        // even for images — skipping this poll causes "Media ID is not available".
        await waitForContainer(container.id, { attempts: 15, intervalMs: 1_000 })
        return container.id
      }
      case 'video': {
        const item = post.media[0]
        if (!item) throw new PublishError('instagram', 'Falta el vídeo.')
        const container = await createVideoContainer(item.publicUrl, post.caption)
        await waitForContainer(container.id)
        return container.id
      }
      case 'carousel': {
        const children = await Promise.all(post.media.map((m) => createCarouselChild(m)))
        // All children (image and video) need to reach FINISHED before the parent
        // can be created and published — poll all of them concurrently.
        await Promise.all(
          children.map((c) => waitForContainer(c.id, { attempts: 15, intervalMs: 1_000 })),
        )
        const parent = await createCarouselContainer(
          children.map((c) => c.id),
          post.caption,
        )
        return parent.id
      }
      default:
        throw new PublishError('instagram', 'Tipo de contenido no soportado en Instagram.')
    }
  }

  fetchInsights(remoteId: string): Promise<PostInsights> {
    return getMediaInsights(remoteId)
  }

  fetchComments(remoteId: string): Promise<PlatformComment[]> {
    return getMediaComments(remoteId)
  }

  replyToComment(remoteCommentId: string, message: string): Promise<void> {
    return replyToComment(remoteCommentId, message)
  }

  deletePost(remoteId: string): Promise<void> {
    return deleteMedia(remoteId)
  }
}
