import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { retryDueVerifactuOutbox } from '@/lib/verifactu/outbox'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.verifactu-outbox')
const BATCH_SIZE = 10

function authenticate(request: NextRequest): boolean {
  const { CRON_SECRET } = serverEnv()
  // A missing secret must fail closed. An unprotected delivery endpoint could
  // be used to force retries, amplify traffic to AEAT, or expose operational
  // state through timing and response behaviour.
  if (!CRON_SECRET) return false
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization
  return token === CRON_SECRET
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authenticate(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const deliveries = await retryDueVerifactuOutbox(BATCH_SIZE)
    const summary = { accepted: 0, rejected: 0, error: 0, skipped: 0, deferred: 0 }
    for (const delivery of deliveries) summary[delivery.status] += 1
    log.info({ total: deliveries.length, ...summary }, 'verifactu outbox cron executed')
    return NextResponse.json({ total: deliveries.length, ...summary }, { status: 200 })
  } catch (error) {
    log.error({ err: error }, 'verifactu outbox cron failed')
    return NextResponse.json({ error: 'verifactu_outbox_failed' }, { status: 500 })
  }
}
