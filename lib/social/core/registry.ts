/**
 * Social Hub — Publisher registry.
 *
 * A tiny open/closed container: register a Publisher per platform, resolve it
 * by key. Adding a network is a `register()` call — the orchestrator, services
 * and UI never change. Keeps composition (which adapters exist) separate from
 * behaviour (how they publish).
 */
import { NotConfiguredError } from './errors'
import type { Publisher } from './publisher'
import type { SocialPlatform } from './types'

export class PublisherRegistry {
  private readonly publishers = new Map<SocialPlatform, Publisher>()

  /** Register (or replace) the Publisher for its platform. Chainable. */
  register(publisher: Publisher): this {
    this.publishers.set(publisher.platform, publisher)
    return this
  }

  /** True when a Publisher exists AND reports configured for the platform. */
  isAvailable(platform: SocialPlatform): boolean {
    const p = this.publishers.get(platform)
    return Boolean(p?.isConfigured())
  }

  /** Resolve a Publisher or throw {@link NotConfiguredError}. */
  get(platform: SocialPlatform): Publisher {
    const publisher = this.publishers.get(platform)
    if (!publisher) throw new NotConfiguredError(platform, `No hay adaptador para ${platform}.`)
    if (!publisher.isConfigured()) throw new NotConfiguredError(platform)
    return publisher
  }

  /** Platforms that have a registered adapter (regardless of config). */
  registered(): SocialPlatform[] {
    return [...this.publishers.keys()]
  }

  /** Platforms that are registered AND configured (safe to publish to). */
  available(): SocialPlatform[] {
    return this.registered().filter((p) => this.isAvailable(p))
  }
}
