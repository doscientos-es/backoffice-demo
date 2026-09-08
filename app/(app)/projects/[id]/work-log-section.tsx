'use client'

import {
  ChevronLeft,
  ChevronRight,
  Clipboard as ClipboardCopy,
  Download,
  Pencil,
  Trash as Trash2,
} from 'lucide-react'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { type AvatarMember, MemberLabel } from '@/components/ui/member-avatar'
import { useOptimisticRemoval } from '@/lib/hooks/use-optimistic-removal'
import { computeHoursFromRange } from '@/lib/schemas/work-log'
import { formatDate, formatEUR } from '@/lib/utils'

import { addWorkLog, deleteWorkLog, updateWorkLog } from './work-log-actions'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildCsvContent(logs: WorkLogRow[]): string {
  const header = ['Fecha', 'Miembro', 'Horas', 'Inicio', 'Fin', 'Nota'].join(',')
  const rows = logs.map((it) =>
    [
      escapeCsvField(it.work_date),
      escapeCsvField(it.member?.name ?? ''),
      escapeCsvField(String(it.hours)),
      escapeCsvField(it.start_time ?? ''),
      escapeCsvField(it.end_time ?? ''),
      escapeCsvField(it.note ?? ''),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

function buildClipboardText(logs: WorkLogRow[]): string {
  const header = ['Fecha', 'Miembro', 'Horas', 'Rango', 'Nota'].join('\t')
  const rows = logs.map((it) => {
    const range = it.start_time && it.end_time ? `${it.start_time}–${it.end_time}` : ''
    const totalMin = Math.round(it.hours * 60)
    const hrs = Math.floor(totalMin / 60)
    const mins = totalMin % 60
    const hoursLabel = hrs === 0 ? `${mins} min` : mins === 0 ? `${hrs} h` : `${hrs} h ${mins} min`
    return [it.work_date, it.member?.name ?? '', hoursLabel, range, it.note ?? ''].join('\t')
  })
  return [header, ...rows].join('\n')
}

export type WorkLogRow = {
  id: string
  work_date: string
  start_time: string | null
  end_time: string | null
  hours: number
  note: string | null
  member: AvatarMember | null
}

type Props = {
  projectId: string
  logs: WorkLogRow[]
  /** Total invoiced (€, IVA incl.) for the project, used to derive €/h. */
  invoicedTotal: number
  /** Billing model. Hourly projects show accrued amount instead of €/h efectivo. */
  billingType?: 'fixed' | 'hourly'
  /** Configured €/h for hourly projects. Drives the accrued amount in the footer. */
  hourlyRate?: number | null
  canEdit: boolean
}

const today = () => new Date().toISOString().slice(0, 10)

const ROWS_PER_PAGE = 10

function formatHours(h: number): string {
  const totalMin = Math.round(h * 60)
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs} h`
  return `${hrs} h ${mins} min`
}

/**
 * Manual daily hours log for a project. Internal-only (never shown in the
 * client portal). The footer derives the effective €/h from total invoiced
 * ÷ logged hours so fixed-price projects can be checked for profitability.
 */
export function WorkLogSection({
  projectId,
  logs,
  invoicedTotal,
  billingType = 'fixed',
  hourlyRate,
  canEdit,
}: Props) {
  const { items, remove, pending } = useOptimisticRemoval(logs)
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [note, setNote] = useState('')
  const [adding, startAdd] = useTransition()

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const visibleItems = items.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE)

  // Inline edit state for an existing row.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, startSave] = useTransition()

  const totalHours = items.reduce((sum, it) => sum + it.hours, 0)
  const rate = hourlyRate ?? 0
  const isHourly = billingType === 'hourly' && rate > 0
  const accruedAmount = isHourly ? totalHours * rate : null
  const effectiveRate = totalHours > 0 ? invoicedTotal / totalHours : null

  const addDuration = startTime && endTime ? computeHoursFromRange(startTime, endTime) : null
  const editDuration = editStart && editEnd ? computeHoursFromRange(editStart, editEnd) : null

  function onCopy() {
    if (items.length === 0) return
    navigator.clipboard
      .writeText(buildClipboardText(items))
      .then(() => sileo.success({ title: 'Registro copiado al portapapeles.' }))
      .catch(() => sileo.error({ title: 'No se pudo copiar.' }))
  }

  function onDownload() {
    if (items.length === 0) return
    const csv = buildCsvContent(items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registro-horas-${projectId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onAdd() {
    if (addDuration === null) {
      sileo.error({ title: 'La hora de fin debe ser posterior a la de inicio.' })
      return
    }
    startAdd(async () => {
      const res = await addWorkLog({
        project_id: projectId,
        work_date: date,
        start_time: startTime,
        end_time: endTime,
        note,
      })
      if (!res.ok) {
        sileo.error({ title: res.error })
        return
      }
      setStartTime('')
      setEndTime('')
      setNote('')
    })
  }

  function startEdit(it: WorkLogRow) {
    setEditingId(it.id)
    setEditStart(it.start_time ?? '')
    setEditEnd(it.end_time ?? '')
    setEditNote(it.note ?? '')
  }

  function onSaveEdit(id: string) {
    const hasRange = !!editStart && !!editEnd
    if (!editStart !== !editEnd) {
      sileo.error({ title: 'Indica inicio y fin, o deja ambos vacíos.' })
      return
    }
    if (hasRange && editDuration === null) {
      sileo.error({ title: 'La hora de fin debe ser posterior a la de inicio.' })
      return
    }
    startSave(async () => {
      const res = await updateWorkLog({
        id,
        project_id: projectId,
        start_time: hasRange ? editStart : undefined,
        end_time: hasRange ? editEnd : undefined,
        note: editNote,
      })
      if (!res.ok) {
        sileo.error({ title: res.error })
        return
      }
      setEditingId(null)
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Registro de horas</CardTitle>
        {items.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copiar registro al portapapeles"
              title="Copiar al portapapeles"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
            >
              <ClipboardCopy className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onDownload}
              aria-label="Descargar registro como CSV"
              title="Descargar CSV"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
            >
              <Download className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
              aria-label="Fecha"
            />
            <div className="flex items-end gap-1">
              <Input
                type="time"
                value={startTime}
                max={endTime || undefined}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-28 tabular-nums"
                aria-label="Hora de inicio"
              />
              <span className="text-muted-foreground pb-2">→</span>
              <Input
                type="time"
                value={endTime}
                min={startTime || undefined}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-28 tabular-nums"
                aria-label="Hora de fin"
              />
            </div>
            <span className="text-muted-foreground pb-2 text-sm tabular-nums">
              {addDuration !== null ? formatHours(addDuration) : '—'}
            </span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota (opcional)"
              maxLength={500}
              className="min-w-40 flex-1"
              aria-label="Nota"
            />
            <Button size="sm" onClick={onAdd} disabled={adding}>
              Añadir
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin horas registradas.</p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Miembro</th>
                  <th className="px-3 py-2 text-right font-medium">Horas</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                  {canEdit ? <th className="w-9 px-1 py-2" aria-label="acciones" /> : null}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((it) =>
                  canEdit && editingId === it.id ? (
                    <tr key={it.id} className="border-border bg-muted/20 border-t">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex flex-wrap items-end gap-2">
                          <span className="text-muted-foreground self-center text-xs whitespace-nowrap tabular-nums">
                            {formatDate(it.work_date)}
                          </span>
                          <div className="flex items-end gap-1">
                            <Input
                              type="time"
                              value={editStart}
                              max={editEnd || undefined}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="w-28 tabular-nums"
                              aria-label="Hora de inicio"
                            />
                            <span className="text-muted-foreground pb-2">→</span>
                            <Input
                              type="time"
                              value={editEnd}
                              min={editStart || undefined}
                              onChange={(e) => setEditEnd(e.target.value)}
                              className="w-28 tabular-nums"
                              aria-label="Hora de fin"
                            />
                          </div>
                          <span className="text-muted-foreground pb-2 text-sm tabular-nums">
                            {editDuration !== null ? formatHours(editDuration) : '—'}
                          </span>
                          <Input
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Nota (opcional)"
                            maxLength={500}
                            className="min-w-40 flex-1"
                            aria-label="Nota"
                          />
                          <Button size="sm" onClick={() => onSaveEdit(it.id)} disabled={saving}>
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={it.id} className="border-border border-t">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {formatDate(it.work_date)}
                      </td>
                      <td className="px-3 py-2">
                        <MemberLabel member={it.member} size="xs" />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatHours(it.hours)}
                        {it.start_time && it.end_time ? (
                          <span className="text-muted-foreground block text-xs font-normal">
                            {it.start_time}–{it.end_time}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">{it.note ?? '—'}</td>
                      {canEdit ? (
                        <td className="px-1 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => startEdit(it)}
                              aria-label="Editar entrada"
                              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                remove(it.id, () =>
                                  deleteWorkLog({ id: it.id, project_id: projectId }),
                                )
                              }
                              disabled={pending}
                              aria-label="Eliminar entrada"
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex size-7 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ),
                )}
              </tbody>
              <tfoot className="border-border bg-muted/20 border-t text-xs">
                <tr>
                  <td colSpan={2} className="text-muted-foreground px-3 py-2 text-right">
                    {isHourly ? 'Total · Importe acumulado' : 'Total · €/h efectivo'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatHours(totalHours)}
                  </td>
                  <td colSpan={canEdit ? 2 : 1} className="px-3 py-2 tabular-nums">
                    {isHourly
                      ? `${formatEUR(accruedAmount ?? 0)} · ${formatEUR(rate)}/h`
                      : effectiveRate !== null
                        ? `${formatEUR(effectiveRate)}/h`
                        : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
            {totalPages > 1 && (
              <div className="border-border text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs">
                <span>
                  {(safePage - 1) * ROWS_PER_PAGE + 1}–
                  {Math.min(safePage * ROWS_PER_PAGE, items.length)} de {items.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    aria-label="Página anterior"
                    className="hover:bg-muted inline-flex size-6 items-center justify-center rounded disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    aria-label="Página siguiente"
                    className="hover:bg-muted inline-flex size-6 items-center justify-center rounded disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
