import { createAdminClient } from '@/lib/supabase/admin'

import type { StorageBucket, StorageProvider } from './types'

export class SupabaseStorageProvider implements StorageProvider {
  private bucket(name: StorageBucket) {
    return createAdminClient().storage.from(name)
  }

  async upload(
    bucket: StorageBucket,
    path: string,
    data: ArrayBuffer,
    opts?: { contentType?: string },
  ): Promise<{ error: string | null }> {
    const { error } = await this.bucket(bucket).upload(path, data, {
      contentType: opts?.contentType ?? 'application/octet-stream',
    })
    return { error: error?.message ?? null }
  }

  async remove(bucket: StorageBucket, paths: string[]): Promise<{ error: string | null }> {
    const { error } = await this.bucket(bucket).remove(paths)
    return { error: error?.message ?? null }
  }

  async download(
    bucket: StorageBucket,
    path: string,
  ): Promise<{ data: ArrayBuffer | null; error: string | null }> {
    const { data, error } = await this.bucket(bucket).download(path)
    return { data: data ? await data.arrayBuffer() : null, error: error?.message ?? null }
  }

  async createSignedUrl(
    bucket: StorageBucket,
    path: string,
    ttlSeconds: number,
  ): Promise<{ url: string | null; error: string | null }> {
    const { data, error } = await this.bucket(bucket).createSignedUrl(path, ttlSeconds)
    return { url: data?.signedUrl ?? null, error: error?.message ?? null }
  }
}
