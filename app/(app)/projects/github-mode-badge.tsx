import { GitBranch as Github, Link as Link2, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { GitHubSyncMode } from './github-sync-section'

const META: Record<
  GitHubSyncMode,
  { label: string; variant: 'neutral' | 'info' | 'success'; icon: typeof Github }
> = {
  none: { label: 'Sin GitHub', variant: 'neutral', icon: Github },
  link_only: { label: 'Solo enlace', variant: 'info', icon: Link2 },
  bidirectional: { label: 'Sync', variant: 'success', icon: RefreshCw },
}

/**
 * Compact badge for the project's GitHub integration mode. Render anywhere
 * a project surface (list, quick view, header, etc.) needs to communicate
 * how strongly the backoffice talks to GitHub.
 */
export function GitHubModeBadge({
  mode,
  showLabel = true,
}: {
  mode: GitHubSyncMode | string | null | undefined
  showLabel?: boolean
}) {
  const m = META[(mode ?? 'none') as GitHubSyncMode] ?? META.none
  const Icon = m.icon
  return (
    <Badge variant={m.variant} title={m.label}>
      <Icon className="size-3" />
      {showLabel ? m.label : null}
    </Badge>
  )
}
