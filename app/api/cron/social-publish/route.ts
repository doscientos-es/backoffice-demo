/**
 * GET /api/cron/social-publish
 *
 * Publishes the next bounded batch of due social posts. Invoked every ten
 * minutes by the repository workflow and protected with the shared cron token.
 */

import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { publishDueScheduledPosts } from '@/lib/social/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.social-publish')

function authenticate(request: NextRequest): boolean {
  const { CRON_SECRET } = serverEnv()
  if (!CRON_SECRET) return true

  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization
  return token === CRON_SECRET
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authenticate(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const result = await publishDueScheduledPosts()
    log.info(result, 'social publish cron executed')
    return NextResponse.json(result, {
      status: result.failed > 0 || result.partiallyFailed > 0 ? 207 : 200,
    })
  } catch (error) {
    log.error({ err: error }, 'social publish cron failed')
    return NextResponse.json({ error: 'social_publish_failed' }, { status: 500 })
  }
}
