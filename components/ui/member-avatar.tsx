'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MemberProfilePopover, type ProfiledMember } from '@/components/ui/member-profile-popover'
import { cn, memberAvatarUrl } from '@/lib/utils'

/** Member shape this component needs to resolve an avatar + initials fallback. */
export type AvatarMember = {
  id?: string
  name: string
  avatar_url: string | null
  github_handle: string | null
}

function initials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : parts[0]?.[0]
  return (letters ?? '?').toUpperCase()
}

function hasProfile(member: AvatarMember | null): member is ProfiledMember {
  return Boolean(member?.id)
}

/**
 * Presentational avatar for a team member. Resolves the image via
 * `memberAvatarUrl` (explicit avatar → GitHub → none) and falls back to
 * initials. When `member` is `null`, renders a neutral "unassigned" dot.
 */
export function MemberAvatar({
  member,
  size = 'sm',
  className,
}: {
  member: AvatarMember | null
  size?: 'xs' | 'sm' | 'default' | 'lg'
  className?: string
}) {
  if (!member) {
    return (
      <Avatar size={size} className={cn('border border-dashed border-border', className)}>
        <AvatarFallback className="text-muted-foreground bg-transparent">—</AvatarFallback>
      </Avatar>
    )
  }

  const src = memberAvatarUrl({ avatarUrl: member.avatar_url, githubHandle: member.github_handle })

  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={member.name} referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{initials(member.name)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * Avatar + name in a row. Handy for inline "responsable" labels in detail
 * panes and lists. Shows "Sin asignar" when there is no owner.
 */
export function MemberLabel({
  member,
  size = 'sm',
  className,
}: {
  member: AvatarMember | null
  size?: 'xs' | 'sm' | 'default' | 'lg'
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
      {hasProfile(member) ? (
        <MemberProfilePopover
          member={member}
          avatar={<MemberAvatar member={member} size={size} />}
          profileAvatar={<MemberAvatar member={member} size="default" className="size-8" />}
        />
      ) : (
        <MemberAvatar member={member} size={size} />
      )}
      <span className={cn('truncate', !member && 'text-muted-foreground')}>
        {member ? member.name : 'Sin asignar'}
      </span>
    </span>
  )
}
