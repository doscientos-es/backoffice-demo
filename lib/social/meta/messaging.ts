import { serverEnv } from '@/lib/env'
import type { MetaPlatform } from '@/lib/social/automation/types'

import { graphPost } from './graph-client'

function messagingPageId(): string {
  const env = serverEnv()
  return env.META_MESSAGING_PAGE_ID || env.FACEBOOK_PAGE_ID
}

/** Send the single comment-triggered Private Reply allowed by Meta. */
export async function sendPrivateReply(
  platform: MetaPlatform,
  remoteCommentId: string,
  message: string,
): Promise<void> {
  if (!messagingPageId()) {
    throw new Error(
      `Meta no tiene configurado el Page ID de mensajería para ${platform}. Define META_MESSAGING_PAGE_ID.`,
    )
  }
  await graphPost(`${messagingPageId()}/messages`, {
    recipient: JSON.stringify({ comment_id: remoteCommentId }),
    message: JSON.stringify({ text: message }),
  })
}
