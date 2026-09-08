import type { SocialPlatform } from '@/lib/social/core'

export type MetaPlatform = Extract<SocialPlatform, 'instagram' | 'facebook'>

export interface AutomationRule {
  id: string
  postId: string | null
  platform: MetaPlatform
  keyword: string
  keywordNormalized: string
  publicReply: string
  privateMessage: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAutomationRuleInput {
  postId: string | null
  platforms: MetaPlatform[]
  keyword: string
  publicReply: string
  privateMessage: string
  createdBy: string | null
}

export interface MetaCommentEvent {
  platform: MetaPlatform
  sourceId: string
  remotePostId: string
  remoteCommentId: string
  authorId: string | null
  authorName: string
  text: string
  publishedAt: string | null
}

export type AutomationRunStatus = 'pending' | 'sending' | 'sent' | 'failed'

export type AutomationEventOutcome =
  | 'received'
  | 'ignored_self'
  | 'ignored_no_target'
  | 'ignored_no_rule'
  | 'matched'
  | 'completed'
  | 'failed'

export interface AutomationAuditEvent {
  id: string
  platform: MetaPlatform
  remotePostId: string
  remoteCommentId: string
  targetId: string | null
  postId: string | null
  ruleId: string | null
  runId: string | null
  authorId: string | null
  authorName: string
  commentText: string
  outcome: AutomationEventOutcome
  error: string | null
  privateStatus: AutomationRunStatus | null
  publicStatus: AutomationRunStatus | null
  createdAt: string
  updatedAt: string
}
