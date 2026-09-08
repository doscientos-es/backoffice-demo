import { type NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

const FALLBACK_URL = 'https://doscientos.es'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // The real destination is passed as `?url=<encoded>` so we don't need a
  // separate links table for v1. The redirect happens immediately; the DB
  // update runs after.
  const rawUrl = req.nextUrl.searchParams.get('url')
  const destination = rawUrl ? decodeURIComponent(rawUrl) : FALLBACK_URL

  // Record the click (fire-and-forget from the user's perspective — we reply
  // with a redirect before the DB write resolves in edge runtimes).
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('lead_campaign_sends')
    .select('id, clicked_at, click_count')
    .eq('tracking_token', token)
    .maybeSingle()

  if (data) {
    await supabase
      .from('lead_campaign_sends')
      .update({
        clicked_at: data.clicked_at ?? new Date().toISOString(),
        click_count: (data.click_count ?? 0) + 1,
      })
      .eq('id', data.id)
  }

  return NextResponse.redirect(destination, { status: 302 })
}
