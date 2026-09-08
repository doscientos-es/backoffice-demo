'use client'

import { createLocalDataClient } from '@/lib/demo/local-data'

let client: ReturnType<typeof createLocalDataClient> | null = null

export function getBrowserClient() {
  if (client) return client
  client = createLocalDataClient()
  return client
}
