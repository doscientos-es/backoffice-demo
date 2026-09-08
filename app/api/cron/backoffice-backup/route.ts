import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Backups remotos desactivados en la demo.' }, { status: 404 })
}
