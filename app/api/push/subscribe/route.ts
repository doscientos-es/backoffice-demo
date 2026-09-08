import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string } }

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = (await request.json()) as Body
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth)
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
  const { error } = await createAdminClient().from('push_subscriptions').upsert(
    {
      member_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = (await request.json()) as { endpoint?: string }
  if (body.endpoint)
    await createAdminClient()
      .from('push_subscriptions')
      .delete()
      .eq('member_id', user.id)
      .eq('endpoint', body.endpoint)
  return NextResponse.json({ ok: true })
}
