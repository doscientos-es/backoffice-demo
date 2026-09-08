// Keep this URL as a backwards-compatible alias. Meta Page subscriptions send
// leadgen and feed/comment events through the same callback.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export { GET, POST } from '@/app/api/webhooks/meta-leads/route'
