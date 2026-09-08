import { NextResponse } from 'next/server'

/** All routes are public in the demo; authentication is replaced by a demo user. */
export function proxy() {
  return NextResponse.next()
}

export const config = { matcher: ['/((?!favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }