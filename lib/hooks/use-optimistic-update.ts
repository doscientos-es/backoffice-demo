'use client'

import { sileo } from 'sileo'

import { useOptimisticUpdate as base } from '@/primitives/hooks/use-optimistic-update'

/**
 * App wrapper around the primitive `useOptimisticUpdate` that surfaces failures
 * as a sileo error toast. Preserves the pre-extraction call signature.
 */
export function useOptimisticUpdate<T>(initial: T) {
  return base<T>(initial, (message) => sileo.error({ title: message }))
}
