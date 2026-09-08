import type { ReactNode } from 'react'

import type { KeyPoint } from '@/lib/proposals/key-points'

/**
 * Portal-side rendering primitives for the proposal narrative
 * (Context / Problems / Solutions). Co-located with the portal page
 * because their styling is tightly coupled to the surrounding document
 * shell and not reused on the deck or in the editor.
 */

export function PortalNarrativeBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="px-6 py-6 sm:px-8">
      <p className="mb-3 text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
        {label}
      </p>
      {children}
    </section>
  )
}

export function PortalKeyPointsList({
  items,
  variant,
}: {
  items: KeyPoint[]
  /**
   * Visual treatment differs by block so the two ordered lists in the
   * portal don't feel repetitive when displayed back-to-back.
   */
  variant: 'problems' | 'solutions'
}) {
  const isProblems = variant === 'problems'
  const badgeClass = isProblems
    ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    : 'bg-[#2A4227] text-white dark:bg-[#9CC196] dark:text-[#1a2b18]'
  return (
    <ol className="flex flex-col gap-3">
      {items.map((kp, i) => (
        <li key={kp.id} className="flex gap-3">
          <span
            className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${badgeClass}`}
            aria-hidden
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm leading-snug font-semibold text-zinc-900 dark:text-zinc-100">
              {kp.title}
            </p>
            {kp.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {kp.description}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
