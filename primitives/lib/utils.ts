import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEUR(value: number | string | null | undefined): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(d)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  const diff = (Date.now() - d.getTime()) / 1000
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  if (abs < 60) return rtf.format(Math.round(-diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(-diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(-diff / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(-diff / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(-diff / 2592000), 'month')
  return rtf.format(Math.round(-diff / 31536000), 'year')
}

export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}
