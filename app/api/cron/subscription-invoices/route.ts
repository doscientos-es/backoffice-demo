/**
 * GET /api/cron/subscription-invoices
 *
 * Creates draft invoices for every active subscription due today or earlier.
 * Called daily by the repository workflow; safe to retry.
 */

import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { generateDueSubscriptionInvoices } from '@/lib/subscriptions/generate-invoices'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.subscription-invoices')

function authenticate(request: NextRequest): boolean {
  const { CRON_SECRET } = serverEnv()
  if (!CRON_SECRET) return true

  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  return token === CRON_SECRET
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateDueSubscriptionInvoices()
    log.info(
      {
        checked: result.checked,
        generated: result.generated.length,
        failed: result.failures.length,
      },
      'subscription invoices cron executed',
    )
    return NextResponse.json(result, { status: result.failures.length > 0 ? 207 : 200 })
  } catch (error) {
    log.error({ err: error }, 'subscription invoices cron failed')
    return NextResponse.json({ error: 'subscription_invoice_generation_failed' }, { status: 500 })
  }
}
