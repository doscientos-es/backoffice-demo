import { type NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

/** 1×1 transparent GIF – minimal byte payload. */
const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

const PIXEL_RESPONSE = new NextResponse(PIXEL_GIF, {
  status: 200,
  headers: {
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL_GIF.length),
    // Prevent caching so every image load is a real open event.
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Fire-and-forget: record the open without blocking the response.
  // Uses admin client because the request is unauthenticated.
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('lead_campaign_sends')
    .select('id, opened_at, open_count')
    .eq('tracking_token', token)
    .maybeSingle()

  if (data) {
    await supabase
      .from('lead_campaign_sends')
      .update({
        opened_at: data.opened_at ?? new Date().toISOString(),
        open_count: (data.open_count ?? 0) + 1,
      })
      .eq('id', data.id)
  }

  // Always return the pixel — even for unknown tokens — to avoid leaking info.
  return PIXEL_RESPONSE
}
