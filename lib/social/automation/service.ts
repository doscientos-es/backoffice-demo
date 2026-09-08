import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { canReply } from '@/lib/social/core'
import { sendPrivateReply } from '@/lib/social/meta/messaging'
import { socialRegistry } from '@/lib/social/registry'
import * as repo from '@/lib/social/repo'

import { matchesAutomationKeyword, selectMatchingRule } from './matcher'
import type { MetaCommentEvent } from './types'

const log = scopedLogger('social-automation')

export type AutomationProcessResult = 'ignored' | 'no_match' | 'processed' | 'duplicate'

/** Process one Meta comment with post-specific rules taking precedence globally. */
export async function processMetaCommentEvent(
  event: MetaCommentEvent,
): Promise<AutomationProcessResult> {
  // Private replies are an external side effect. Keep the feature disabled by
  // default so a database rule or webhook retry cannot send messages unless the
  // deployment explicitly opts in through META_SOCIAL_AUTOMATION_ENABLED=true.
  if (!serverEnv().META_SOCIAL_AUTOMATION_ENABLED) return 'ignored'

  const audit = await repo.getOrCreateAutomationEvent({
    platform: event.platform,
    sourceId: event.sourceId,
    remotePostId: event.remotePostId,
    remoteCommentId: event.remoteCommentId,
    authorId: event.authorId,
    authorName: event.authorName,
    commentText: event.text,
  })
  const terminalOutcomes = new Set([
    'completed',
    'ignored_self',
    'ignored_no_target',
    'ignored_no_rule',
  ])
  if (audit.duplicate && terminalOutcomes.has(audit.outcome)) return 'duplicate'

  // Meta can send our own replies back through the feed webhook; never loop on them.
  if (event.authorId && event.authorId === event.sourceId) {
    await repo.updateAutomationEvent(audit.id, { outcome: 'ignored_self' })
    return 'ignored'
  }

  let activeRunId: string | null = null
  let activeStep: 'private' | 'public' | null = null
  try {
    const target = await repo.findTargetByRemoteId(event.platform, event.remotePostId)
    if (!target) {
      await repo.updateAutomationEvent(audit.id, { outcome: 'ignored_no_target' })
      return 'ignored'
    }
    await repo.updateAutomationEvent(audit.id, { targetId: target.id, postId: target.postId })

    await repo.upsertComments(target.id, event.platform, [
      {
        remoteId: event.remoteCommentId,
        authorName: event.authorName,
        authorId: event.authorId,
        text: event.text,
        likeCount: 0,
        publishedAt: event.publishedAt,
      },
    ])

    const rules = await repo.listApplicableAutomationRules(target.postId, event.platform)
    const rule = selectMatchingRule(rules, target.postId, event.text)
    if (!rule || !matchesAutomationKeyword(event.text, rule.keyword)) {
      await repo.updateAutomationEvent(audit.id, { outcome: 'ignored_no_rule' })
      return 'no_match'
    }

    const run = await repo.getOrCreateAutomationRun({
      ruleId: rule.id,
      targetId: target.id,
      platform: event.platform,
      remoteCommentId: event.remoteCommentId,
    })
    activeRunId = run.id
    await repo.updateAutomationEvent(audit.id, {
      ruleId: rule.id,
      runId: run.id,
      outcome: 'matched',
    })
    if (run.privateStatus === 'sent' && run.publicStatus === 'sent') {
      await repo.updateAutomationEvent(audit.id, { outcome: 'completed' })
      return 'processed'
    }

    if (run.privateStatus !== 'sent' && (await repo.claimAutomationStep(run.id, 'private'))) {
      activeStep = 'private'
      await sendPrivateReply(event.platform, event.remoteCommentId, rule.privateMessage)
      await repo.updateAutomationRun(run.id, { privateStatus: 'sent', error: null })
      activeStep = null
    } else if (run.privateStatus !== 'sent') {
      // Another delivery is already sending the private reply. Do not publish the
      // public confirmation until that request has completed successfully.
      return 'processed'
    }

    if (run.publicStatus !== 'sent' && (await repo.claimAutomationStep(run.id, 'public'))) {
      activeStep = 'public'
      const registry = socialRegistry()
      if (!registry.isAvailable(event.platform)) {
        throw new Error(`La red ${event.platform} no está configurada para responder comentarios.`)
      }
      const publisher = registry.get(event.platform)
      if (!canReply(publisher)) throw new Error(`La red ${event.platform} no permite respuestas.`)
      await publisher.replyToComment(event.remoteCommentId, rule.publicReply)
      await repo.updateAutomationRun(run.id, { publicStatus: 'sent', error: null })
      await repo.markCommentRepliedByRemote(target.id, event.remoteCommentId)
      activeStep = null
    }

    await repo.updateAutomationEvent(audit.id, { outcome: 'completed', error: null })
    return 'processed'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (activeRunId && activeStep) {
      await repo.updateAutomationRun(activeRunId, {
        ...(activeStep === 'private' ? { privateStatus: 'failed' } : { publicStatus: 'failed' }),
        error: message,
      })
    }
    await repo.updateAutomationEvent(audit.id, { outcome: 'failed', error: message })
    log.warn(
      { platform: event.platform, remoteCommentId: event.remoteCommentId },
      'automation_event_failed',
    )
    throw error
  }
}
