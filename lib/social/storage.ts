/**
 * Social Hub — media storage helper.
 *
 * Uploads composer files to the PUBLIC `social-media` bucket and returns
 * platform-neutral MediaItem[] (public URLs are mandatory for Instagram/Facebook
 * container publishing). Uses the service-role admin client for the happy path,
 * matching the bucket's insert policy note in the migration.
 */
import { randomUUID } from 'node:crypto'

import { scopedLogger } from '@/lib/logger'
import type { MediaItem } from '@/lib/social/core'
import { PublishError } from '@/lib/social/core'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('social-storage')

const BUCKET = 'social-media'

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

function mediaTypeFor(mime: string): 'image' | 'video' {
  return mime.startsWith('video/') ? 'video' : 'image'
}

/** Upload N files, preserving order. Rolls back already-uploaded files on error. */
export async function uploadMedia(files: File[]): Promise<MediaItem[]> {
  const supabase = createAdminClient()
  const uploaded: MediaItem[] = []
  try {
    for (const file of files) {
      const mime = file.type
      const ext = EXT_BY_MIME[mime]
      if (!ext) throw new PublishError('instagram', `Tipo de archivo no permitido: ${mime}.`)
      const path = `uploads/${randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: mime, upsert: false })
      if (error) throw new PublishError('instagram', `Error subiendo media: ${error.message}`)
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      uploaded.push({
        storagePath: path,
        publicUrl: data.publicUrl,
        type: mediaTypeFor(mime),
        mime,
      })
    }
    return uploaded
  } catch (err) {
    if (uploaded.length) {
      await removeMedia(uploaded.map((m) => m.storagePath)).catch(() => {})
    }
    throw err
  }
}

/** Remove media by storage path (best-effort cleanup). */
export async function removeMedia(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) log.warn({ paths, err: error.message }, 'social_media_remove_failed')
}
