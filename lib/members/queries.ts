import { cache } from 'react'

import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Minimal team member shape used to populate owner/assignee selectors and to
 * render avatars (via `memberAvatarUrl`) with an initials fallback.
 */
export type MemberOption = {
  id: string
  name: string
  avatar_url: string | null
  github_handle: string | null
}

/**
 * Lists active (non soft-deleted) team members ordered by name.
 * Wrapped with React.cache() to deduplicate DB calls within the same render.
 */
export const listActiveMembers = cache(async (): Promise<MemberOption[]> => {
  const supabase = await createServerClient()
  const { data } = await notDeleted(
    supabase.from('team_members').select('id, name, avatar_url, github_handle'),
  ).order('name', { ascending: true })

  return (data ?? []).map((m) => ({
    id: m.id as string,
    name: (m.name as string | null) ?? '',
    avatar_url: (m.avatar_url as string | null) ?? null,
    github_handle: (m.github_handle as string | null) ?? null,
  }))
})
