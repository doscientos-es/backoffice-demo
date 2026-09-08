'use client'

import { cn } from '../lib/utils'

const LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'] as const

const COLORS = [
  'bg-destructive/60',
  'bg-destructive',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-emerald-600',
] as const

/**
 * Heuristic password strength on a 0–4 scale.
 * 0 empty · 1 short · 2 ok · 3 good · 4 strong.
 */
export function passwordScore(value: string): number {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/[0-9]/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  return Math.min(score, 4)
}

export interface PasswordStrengthProps {
  value: string
  className?: string
}

export function PasswordStrength({ value, className }: PasswordStrengthProps) {
  if (!value) return null
  const score = passwordScore(value)
  return (
    <div className={cn('mt-1 flex items-center gap-2', className)} aria-live="polite">
      <div className="flex h-1 flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-full transition-colors',
              i < score ? COLORS[score] : 'bg-border',
            )}
          />
        ))}
      </div>
      <span className="text-muted-foreground w-16 text-right text-[11px] tabular-nums">
        {LABELS[score]}
      </span>
    </div>
  )
}
