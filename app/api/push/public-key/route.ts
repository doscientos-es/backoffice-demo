import { NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'

export function GET() {
  return NextResponse.json({ publicKey: serverEnv().WEB_PUSH_VAPID_PUBLIC_KEY })
}
