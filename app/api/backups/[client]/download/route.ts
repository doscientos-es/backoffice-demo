/**
 * Proxy download endpoint for FileBrowser files.
 * Streams the raw file through Next.js so credentials stay server-side.
 *
 * GET /api/backups/[client]/download?path=daily/dump.sql
 */

import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { BACKOFFICE_BACKUP_SLUG } from '@/lib/backups/backoffice'

export async function GET(request: Request, { params }: { params: Promise<{ client: string }> }) {
  const user = await requireUser()

  const { client } = await params
  if (client === BACKOFFICE_BACKUP_SLUG && user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  const filePath = new URL(request.url).searchParams.get('path') ?? ''

  if (!filePath) {
    return NextResponse.json({ error: 'path requerido' }, { status: 400 })
  }

  return NextResponse.json(
    { error: 'Las descargas de backup no están disponibles en la demo local.', path: filePath },
    { status: 404 },
  )
}
