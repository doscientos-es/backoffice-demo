import { NextResponse } from 'next/server'

const MAX_TITLE_LENGTH = 160
const MAX_TEXT_LENGTH = 3000
const MAX_URL_LENGTH = 1000

function value(formData: FormData, name: string, maxLength: number): string {
  const raw = formData.get(name)
  return typeof raw === 'string'
    ? raw.replaceAll(String.fromCharCode(0), '').trim().slice(0, maxLength)
    : ''
}

/** Converts a Web Share Target POST into a pre-filled, authenticated lead form. */
export async function POST(request: Request): Promise<NextResponse> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.redirect(new URL('/leads/new', request.url), { status: 303 })
  }

  const target = new URL('/leads/new', request.url)
  const title = value(formData, 'title', MAX_TITLE_LENGTH)
  const text = value(formData, 'text', MAX_TEXT_LENGTH)
  const url = value(formData, 'url', MAX_URL_LENGTH)
  if (title) target.searchParams.set('shared_title', title)
  if (text) target.searchParams.set('shared_text', text)
  if (url) target.searchParams.set('shared_url', url)
  return NextResponse.redirect(target, { status: 303 })
}
