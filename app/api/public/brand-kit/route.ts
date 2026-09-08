import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Public feed consumed while building the marketing site's brand portal.
 * The admin client is intentional: public callers only receive the public brand catalog.
 */
export async function GET() {
  const supabase = createAdminClient()
  const [tokensResult, guidesResult] = await Promise.all([
    supabase
      .from('brand_tokens')
      .select('token_group, key, value, value_dark, description, sort_order')
      .order('token_group')
      .order('sort_order'),
    supabase
      .from('brand_guides')
      .select('slug, title, description, content, sort_order, published_at')
      .eq('status', 'published')
      .order('sort_order')
      .order('published_at', { ascending: false }),
  ])

  if (tokensResult.error) {
    return NextResponse.json({ error: 'brand_kit_unavailable' }, { status: 503 })
  }

  return NextResponse.json(
    {
      tokens: tokensResult.data ?? [],
      // A missing/unavailable guides table must not block an otherwise valid token sync.
      guides: guidesResult.error ? [] : (guidesResult.data ?? []),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
