import { type NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()

  await supabase
    .from('lead_campaign_sends')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('tracking_token', token)

  return new NextResponse(
    `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baja confirmada</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f7f5; color: #111; }
      main { max-width: 520px; padding: 32px; }
      h1 { font-size: 28px; margin: 0 0 12px; }
      p { color: #555; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Baja confirmada</h1>
      <p>Hemos registrado que no quieres recibir mas emails comerciales de doscientos.</p>
    </main>
  </body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}
