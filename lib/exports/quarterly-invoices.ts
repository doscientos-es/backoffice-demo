import { deflateRawSync } from 'node:zlib'

export type QuarterlyPeriod = {
  year: number
  quarter: 1 | 2 | 3 | 4
  start: string
  end: string
  label: string
}

export type ZipEntry = {
  name: string
  body: Uint8Array
  modifiedAt?: Date
}

const MAX_UINT16 = 0xffff
const MAX_UINT32 = 0xffffffff
const textEncoder = new TextEncoder()

export function quarterlyPeriod(
  yearValue: string | null,
  quarterValue: string | null,
): QuarterlyPeriod | null {
  if (!yearValue || !quarterValue || !/^\d{4}$/.test(yearValue) || !/^[1-4]$/.test(quarterValue)) {
    return null
  }

  const year = Number(yearValue)
  const quarter = Number(quarterValue) as QuarterlyPeriod['quarter']
  const startMonth = (quarter - 1) * 3
  const endMonth = startMonth + 3
  const start = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(year, endMonth, 1)).toISOString().slice(0, 10)
  return { year, quarter, start, end, label: `T${quarter} ${year}` }
}

export function safeFilePart(value: string | null | undefined, fallback: string): string {
  const sanitized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100)
  return sanitized || fallback
}

export function expenseArchiveFilename(input: {
  id: string
  date: string
  vendor: string
  reference: string | null
  name: string
}): string {
  const extension = /\.[a-zA-Z0-9]{1,10}$/.exec(input.name)?.[0] ?? ''
  const baseName = safeFilePart(
    input.name.slice(0, input.name.length - extension.length),
    'documento',
  )
  return `${input.date}_${safeFilePart(input.vendor, 'proveedor')}_${safeFilePart(input.reference, 'sin-ref')}_${baseName}-${input.id.slice(0, 8)}${extension.toLowerCase()}`
}

export function csvWithBom(
  rows: ReadonlyArray<Record<string, string | number | null>>,
  headers?: ReadonlyArray<string>,
): Uint8Array {
  const columns = headers ? [...headers] : [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escapeCell = (value: string | number | null | undefined) =>
    `"${String(value ?? '').replaceAll('"', '""')}"`
  const body = [
    columns.map(escapeCell).join(','),
    ...rows.map((row) => columns.map((header) => escapeCell(row[header])).join(',')),
  ].join('\r\n')
  return textEncoder.encode(`\uFEFF${body}\r\n`)
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(value: Date): { date: number; time: number } {
  const year = Math.min(2107, Math.max(1980, value.getFullYear()))
  return {
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
  }
}

function archiveName(name: string): Buffer {
  if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) {
    throw new Error('Nombre de archivo ZIP inválido')
  }
  const value = Buffer.from(name, 'utf8')
  if (value.length > MAX_UINT16) throw new Error('El nombre de archivo ZIP es demasiado largo')
  return value
}

/** Creates a standards-compliant ZIP using only Node built-ins. */
export function createZip(entries: ReadonlyArray<ZipEntry>): Buffer {
  if (entries.length > MAX_UINT16) throw new Error('La exportación contiene demasiados archivos')

  const localRecords: Buffer[] = []
  const centralRecords: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = archiveName(entry.name)
    const source = Buffer.from(entry.body)
    if (source.length > MAX_UINT32) throw new Error('Un archivo supera el límite del formato ZIP')
    const deflated = deflateRawSync(source)
    const compressed = deflated.length < source.length ? deflated : source
    const method = compressed === source ? 0 : 8
    const { date, time } = dosDateTime(entry.modifiedAt ?? new Date())
    const checksum = crc32(source)

    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(source.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    name.copy(local, 30)
    localRecords.push(local, compressed)

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(source.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)
    centralRecords.push(central)
    offset += local.length + compressed.length
  }

  const centralDirectory = Buffer.concat(centralRecords)
  if (offset > MAX_UINT32 || centralDirectory.length > MAX_UINT32) {
    throw new Error('La exportación supera el límite del formato ZIP')
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...localRecords, centralDirectory, end])
}
