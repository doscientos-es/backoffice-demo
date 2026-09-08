import { LRUCache } from 'lru-cache'

import { createAdminClient } from '@/lib/supabase/admin'

type Bucket = { count: number; resetAt: number }

const buckets = new LRUCache<string, Bucket>({ max: 5000, ttl: 60_000 })

export type RateLimitResult = {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Sliding-fixed-window rate limiter (in-memory, per serverless instance).
 * Sufficient for the public portal traffic; migrate to Redis if/when needed.
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { success: true, remaining: limit - 1, resetAt }
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count++
  return { success: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

/** Reset a bucket (mainly for tests). */
export function resetRateLimit(key: string): void {
  buckets.delete(key)
}

/**
 * Distributed limiter backed by Supabase/Postgres. The local limiter remains
 * as a fallback while a migration is rolling out or if the RPC is temporarily
 * unavailable; public routes must never fail open because a limiter is down.
 */
export async function distributedRateLimit(
  key: string,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await createAdminClient().rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })

    if (!error && typeof data === 'boolean') {
      const resetAt = Date.now() + windowSeconds * 1000
      return {
        success: data,
        remaining: data ? Math.max(0, limit - 1) : 0,
        resetAt,
      }
    }
  } catch {
    // Fall through to the per-instance safety net below.
  }

  return rateLimit(key, limit, windowSeconds * 1000)
}
