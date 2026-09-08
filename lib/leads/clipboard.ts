export type LeadClipboardImport = {
  email?: string
  notes: string
  phone?: string
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_RE = /(?:\+?\d[\d .()-]{7,}\d)/

/** Extracts safe form hints from text explicitly pasted by the user. */
export function parseLeadClipboard(text: string): LeadClipboardImport {
  const trimmed = text.replaceAll(String.fromCharCode(0), '').trim().slice(0, 4000)
  const email = trimmed.match(EMAIL_RE)?.[0]
  const phone = trimmed.match(PHONE_RE)?.[0]?.trim()
  return { email, phone, notes: trimmed }
}
