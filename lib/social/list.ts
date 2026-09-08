import type { MediaKind, PostStatus, SocialPlatform } from '@/lib/social/core'
import type { PostListItem } from '@/lib/social/types'

export type SocialPostSort =
  | 'created_desc'
  | 'created_asc'
  | 'scheduled_asc'
  | 'published_desc'
  | 'engagement_desc'

export const SOCIAL_POST_SORT_OPTIONS: readonly { value: SocialPostSort; label: string }[] = [
  { value: 'created_desc', label: 'Más recientes' },
  { value: 'created_asc', label: 'Más antiguas' },
  { value: 'scheduled_asc', label: 'Próximas a publicar' },
  { value: 'published_desc', label: 'Publicadas recientemente' },
  { value: 'engagement_desc', label: 'Mayor interacción' },
]

export type SocialPostListFilters = {
  q?: string
  status?: PostStatus | null
  platform?: SocialPlatform | null
  mediaKind?: MediaKind | null
  sort?: SocialPostSort
}

function timestamp(value: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function compareNullableDates(a: string | null, b: string | null, direction: 'asc' | 'desc') {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const result = timestamp(a) - timestamp(b)
  return direction === 'asc' ? result : -result
}

function compareCreated(a: PostListItem, b: PostListItem, direction: 'asc' | 'desc') {
  const result = timestamp(a.createdAt) - timestamp(b.createdAt)
  return direction === 'asc' ? result : -result
}

export function filterAndSortPosts(
  posts: readonly PostListItem[],
  filters: SocialPostListFilters,
): PostListItem[] {
  const query = filters.q?.trim().toLocaleLowerCase() ?? ''
  const filtered = posts.filter((post) => {
    const matchesQuery =
      !query ||
      post.caption.toLocaleLowerCase().includes(query) ||
      post.targets.some((target) => target.caption?.toLocaleLowerCase().includes(query))
    const matchesStatus = !filters.status || post.status === filters.status
    const matchesPlatform =
      !filters.platform || post.targets.some((target) => target.platform === filters.platform)
    const matchesMediaKind = !filters.mediaKind || post.mediaKind === filters.mediaKind
    return matchesQuery && matchesStatus && matchesPlatform && matchesMediaKind
  })

  return [...filtered].sort((a, b) => {
    switch (filters.sort ?? 'created_desc') {
      case 'created_asc':
        return compareCreated(a, b, 'asc')
      case 'scheduled_asc':
        return (
          compareNullableDates(a.scheduledAt, b.scheduledAt, 'asc') || compareCreated(a, b, 'desc')
        )
      case 'published_desc':
        return (
          compareNullableDates(a.publishedAt, b.publishedAt, 'desc') || compareCreated(a, b, 'desc')
        )
      case 'engagement_desc': {
        const engagementA = a.metrics.likes + a.metrics.comments
        const engagementB = b.metrics.likes + b.metrics.comments
        return engagementB - engagementA || compareCreated(a, b, 'desc')
      }
      default:
        return compareCreated(a, b, 'desc')
    }
  })
}
