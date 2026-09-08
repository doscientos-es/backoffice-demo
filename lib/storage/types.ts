export type StorageBucket = 'documents' | 'internal-docs' | 'brand-assets'

export interface StorageProvider {
  upload(
    bucket: StorageBucket,
    path: string,
    data: ArrayBuffer,
    opts?: { contentType?: string },
  ): Promise<{ error: string | null }>

  remove(bucket: StorageBucket, paths: string[]): Promise<{ error: string | null }>

  download(
    bucket: StorageBucket,
    path: string,
  ): Promise<{ data: ArrayBuffer | null; error: string | null }>

  createSignedUrl(
    bucket: StorageBucket,
    path: string,
    ttlSeconds: number,
  ): Promise<{ url: string | null; error: string | null }>
}
