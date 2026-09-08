import { type NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import {
  dataToCsv,
  exportAllOperationalData,
  exportTable,
  isExportableTable,
} from '@/lib/exports/data'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('api.data-export')

function download(body: string, contentType: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')
  const stamp = new Date().toISOString().slice(0, 10)

  try {
    if (format === 'json') {
      const data = await exportAllOperationalData()
      log.info({ tables: Object.keys(data.tables).length }, 'operational_data_exported_json')
      return download(
        JSON.stringify(data, null, 2),
        'application/json; charset=utf-8',
        `doscientos-datos-${stamp}.json`,
      )
    }

    const table = searchParams.get('table')
    if (format !== 'csv' || !isExportableTable(table)) {
      return NextResponse.json({ error: 'Formato o tabla no válidos' }, { status: 400 })
    }

    const rows = await exportTable(table)
    log.info({ table, count: rows.length }, 'operational_data_exported_csv')
    return download(
      `\uFEFF${dataToCsv(rows)}`,
      'text/csv; charset=utf-8',
      `doscientos-${table}-${stamp}.csv`,
    )
  } catch (error) {
    log.error({ err: error }, 'operational_data_export_failed')
    return NextResponse.json({ error: 'No se pudo generar la exportación' }, { status: 500 })
  }
}
