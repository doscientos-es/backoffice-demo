import webpush from 'web-push'

import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  badge?: number
  actions?: Array<{ action: string; title: string }>
  data?: Record<string, string | null>
}
type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string }

function configure() {
  const env = serverEnv()
  if (!env.WEB_PUSH_VAPID_PUBLIC_KEY || !env.WEB_PUSH_VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(
    env.WEB_PUSH_VAPID_SUBJECT,
    env.WEB_PUSH_VAPID_PUBLIC_KEY,
    env.WEB_PUSH_VAPID_PRIVATE_KEY,
  )
  return true
}

export async function sendWebPushToMembers(memberIds: string[], payload: PushPayload) {
  if (!memberIds.length || !configure()) return
  const admin = createAdminClient()
  const { data } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('member_id', memberIds)
  if (!data?.length) return
  await Promise.allSettled(
    (data as StoredSubscription[]).map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410)
          await admin.from('push_subscriptions').delete().eq('id', row.id)
      }
    }),
  )
}
