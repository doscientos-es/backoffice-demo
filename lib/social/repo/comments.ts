/**
 * Social Hub — comments repository.
 *
 * Upserts the unified comment inbox (deduped by target_id + remote_comment_id)
 * and reads it back joined with each post's caption for context. Sync writes use
 * the admin client (background jobs, no user session); reads use the RLS server
 * client. Replies flip the `replied` flag once a Publisher confirms them.
 */
import { scopedLogger } from '@/lib/logger'
import type { PlatformComment, SocialPlatform } from '@/lib/social/core'
import type { CommentView } from '@/lib/social/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('social-repo-comments')

interface CommentRow {
  id: string
  target_id: string
  platform: string
  remote_comment_id: string
  author_name: string
  text: string
  like_count: number
  replied: boolean
  published_at: string | null
  social_post_targets: { post_id: string; social_posts: { caption: string } | null } | null
}

function mapComment(row: CommentRow): CommentView {
  return {
    id: row.id,
    targetId: row.target_id,
    platform: row.platform as SocialPlatform,
    remoteCommentId: row.remote_comment_id,
    authorName: row.author_name,
    text: row.text,
    likeCount: row.like_count,
    replied: row.replied,
    publishedAt: row.published_at,
    postId: row.social_post_targets?.post_id ?? '',
    postCaption: row.social_post_targets?.social_posts?.caption ?? '',
  }
}

const COMMENT_SELECT =
  'id, target_id, platform, remote_comment_id, author_name, text, like_count, ' +
  'replied, published_at, social_post_targets(post_id, social_posts(caption))'

/** Upsert a batch of comments for a target, preserving the `replied` flag. */
export async function upsertComments(
  targetId: string,
  platform: SocialPlatform,
  comments: PlatformComment[],
): Promise<void> {
  if (comments.length === 0) return
  const supabase = createAdminClient()
  const rows = comments.map((c) => ({
    target_id: targetId,
    platform,
    remote_comment_id: c.remoteId,
    author_name: c.authorName,
    author_id: c.authorId,
    text: c.text,
    like_count: c.likeCount,
    published_at: c.publishedAt,
  }))
  const { error } = await supabase
    .from('social_comments')
    .upsert(rows, { onConflict: 'target_id, remote_comment_id' })
  if (error) log.error({ targetId, err: error.message }, 'upsert_comments_failed')
}

/** List the unified comment inbox newest-first, joined with post captions. */
export async function listComments(): Promise<CommentView[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('social_comments')
    .select(COMMENT_SELECT)
    .order('published_at', { ascending: false })
  if (error) {
    log.error({ err: error.message }, 'list_comments_failed')
    return []
  }
  return (data as unknown as CommentRow[]).map(mapComment)
}

/** List comments belonging to the given post targets, newest-first. */
export async function listCommentsForTargets(targetIds: string[]): Promise<CommentView[]> {
  if (targetIds.length === 0) return []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('social_comments')
    .select(COMMENT_SELECT)
    .in('target_id', targetIds)
    .order('published_at', { ascending: false })
  if (error) {
    log.error({ err: error.message }, 'list_comments_for_targets_failed')
    return []
  }
  return (data as unknown as CommentRow[]).map(mapComment)
}

/** A comment resolved to the fields a reply needs (platform + remote id). */
export interface CommentRef {
  id: string
  platform: SocialPlatform
  remoteCommentId: string
  replied: boolean
}

/** Fetch the minimal fields needed to reply to a comment, or null. */
export async function getComment(commentId: string): Promise<CommentRef | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('social_comments')
    .select('id, platform, remote_comment_id, replied')
    .eq('id', commentId)
    .maybeSingle()
  if (error) log.error({ commentId, err: error.message }, 'get_comment_failed')
  if (!data) return null
  const row = data as { id: string; platform: string; remote_comment_id: string; replied: boolean }
  return {
    id: row.id,
    platform: row.platform as SocialPlatform,
    remoteCommentId: row.remote_comment_id,
    replied: row.replied,
  }
}

/** Mark a comment as replied once a Publisher confirms the reply. */
export async function markReplied(commentId: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('social_comments')
    .update({ replied: true })
    .eq('id', commentId)
  if (error) log.error({ commentId, err: error.message }, 'mark_replied_failed')
}
