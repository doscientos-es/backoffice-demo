/**
 * Social Hub — composition root for Publishers.
 *
 * The ONE place that wires concrete adapters into the core PublisherRegistry.
 * Everything else depends on the registry abstraction, so adding a network is a
 * single `register()` here. Cached per-process; adapters read env lazily and
 * self-report `isConfigured()`, so an unconfigured network is simply skipped.
 */
import { PublisherRegistry } from '@/lib/social/core'
import { FacebookPublisher, InstagramPublisher } from '@/lib/social/meta'

let cached: PublisherRegistry | null = null

/** Shared registry with all supported publishing adapters registered. */
export function socialRegistry(): PublisherRegistry {
  if (cached) return cached
  cached = new PublisherRegistry()
    .register(new InstagramPublisher())
    .register(new FacebookPublisher())
  return cached
}
