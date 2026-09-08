'use client'

import { sileo } from 'sileo'

import { useOptimisticRemoval as base } from '@/primitives/hooks/use-optimistic-removal'

/**
 * App wrapper around the primitive `useOptimisticRemoval` that surfaces failures
 * as a sileo error toast. Preserves the pre-extraction call signature.
 */
export function useOptimisticRemoval<T extends { id: string }>(items: T[]) {
  return base<T>(items, (message) => sileo.error({ title: message }))
}
