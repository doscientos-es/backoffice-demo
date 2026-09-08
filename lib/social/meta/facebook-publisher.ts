/**
 * Social Hub — Facebook Page Publisher (adapter).
 *
 * Implements the core Publisher port for the Page by composing facebook-api.ts.
 * Unlike Instagram, Facebook accepts text-only posts and single video/photo
 * directly; multi-photo posts become a feed story with attached media. Video
 * carousels are not supported by the Page feed, so we reject them explicitly.
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

import {
  deletePost,
  fbPageId,
  getPermalink,
  getPostComments,
  getPostInsights,
  publishPhoto,
  publishPhotoCarousel,
  publishText,
  publishVideo,
  replyToComment,
} from './facebook-api'
import { metaPageToken } from './graph-client'

const log = scopedLogger('social-facebook')

export class FacebookPublisher implements Publisher {
  readonly platform: SocialPlatform = 'facebook'

  isConfigured(): boolean {
    return Boolean(metaPageToken() && fbPageId())
  }

  supports(post: ComposedPost): PublishSupport {
    if (post.mediaKind === 'carousel' && post.media.some((m) => m.type === 'video')) {
      return { ok: false, reason: 'Facebook no admite carruseles con vídeo desde la API.' }
    }
    return { ok: true }
  }

  async publish(post: ComposedPost): Promise<PublishOutcome> {
    const remoteId = await this.publishByKind(post)
    const remoteUrl = await getPermalink(remoteId).catch(() => null)
    log.info({ postId: post.id, remoteId }, 'Published to Facebook')
    return { remoteId, remoteUrl }
  }

  private async publishByKind(post: ComposedPost): Promise<string> {
    switch (post.mediaKind) {
      case 'text': {
        const ref = await publishText(post.caption)
        return ref.post_id ?? ref.id
      }
      case 'photo': {
        const item = post.media[0]
        if (!item) throw new PublishError('facebook', 'Falta la imagen.')
        return publishPhoto(item.publicUrl, post.caption)
      }
      case 'video': {
        const item = post.media[0]
        if (!item) throw new PublishError('facebook', 'Falta el vídeo.')
        return publishVideo(item.publicUrl, post.caption)
      }
      case 'carousel':
        return publishPhotoCarousel(post.media, post.caption)
      default:
        throw new PublishError('facebook', 'Tipo de contenido no soportado en Facebook.')
    }
  }

  fetchInsights(remoteId: string): Promise<PostInsights> {
    return getPostInsights(remoteId)
  }

  fetchComments(remoteId: string): Promise<PlatformComment[]> {
    return getPostComments(remoteId)
  }

  replyToComment(remoteCommentId: string, message: string): Promise<void> {
    return replyToComment(remoteCommentId, message)
  }

  deletePost(remoteId: string): Promise<void> {
    return deletePost(remoteId)
  }
}
