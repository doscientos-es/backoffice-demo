import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'El inicio de sesión está desactivado en la demo pública.' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  )
}
