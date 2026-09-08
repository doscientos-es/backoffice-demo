import { SupabaseStorageProvider } from './supabase'
import type { StorageProvider } from './types'

export type { StorageBucket, StorageProvider } from './types'

/**
 * Returns the active StorageProvider.
 * The demo always uses its local in-memory implementation.
 */
export function getStorage(): StorageProvider {
  return new SupabaseStorageProvider()
}
