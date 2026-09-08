/**
 * POST /api/cron/web-backups
 *
 * Runs scheduled backups for every active web project with a backup slug and
 * complete DB credentials. Intended to be called weekly by the backup server.
 *
 * Auth: Authorization: Bearer <CRON_SECRET | BACKUP_RUNNER_TOKEN>
 */

import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { getConfiguredWebBackupTargets } from '@/lib/webs/credentials'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cron.web-backups')

type BackupResult = {
  id: string
  name: string
  backupSlug: string
  ok: boolean
  status?: number
  error?: string
}

function authenticate(request: NextRequest): boolean {
  const { BACKUP_RUNNER_TOKEN, CRON_SECRET } = serverEnv()
  const allowedTokens = [CRON_SECRET, BACKUP_RUNNER_TOKEN].filter(Boolean)
  if (allowedTokens.length === 0) return true

  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  return allowedTokens.includes(token)
}

async function runBackup(
  target: Awaited<ReturnType<typeof getConfiguredWebBackupTargets>>[number],
) {
  const env = serverEnv()
  const res = await fetch(env.BACKUP_RUNNER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.BACKUP_RUNNER_TOKEN}`,
    },
    body: JSON.stringify({
      clientSlug: target.backupSlug,
      host: target.credentials.host,
      port: target.credentials.port,
      database: target.credentials.name,
      user: target.credentials.user,
      password: target.credentials.password,
      schedule: 'weekly',
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(detail?.error ?? `runner returned HTTP ${res.status}`)
  }
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const env = serverEnv()
  if (!env.BACKUP_RUNNER_URL || !env.BACKUP_RUNNER_TOKEN) {
    return NextResponse.json({ error: 'backup runner not configured' }, { status: 503 })
  }

  const targets = await getConfiguredWebBackupTargets()
  const results: BackupResult[] = []

  for (const target of targets) {
    try {
      await runBackup(target)
      results.push({
        id: target.id,
        name: target.name,
        backupSlug: target.backupSlug,
        ok: true,
      })
    } catch (err) {
      results.push({
        id: target.id,
        name: target.name,
        backupSlug: target.backupSlug,
        ok: false,
        error: err instanceof Error ? err.message : 'unknown backup error',
      })
    }
  }

  const ok = results.filter((r) => r.ok).length
  const failed = results.length - ok

  log.info({ total: results.length, ok, failed }, 'web backups cron executed')

  return NextResponse.json(
    {
      total: results.length,
      ok,
      failed,
      results,
    },
    { status: failed > 0 ? 207 : 200 },
  )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request)
}
