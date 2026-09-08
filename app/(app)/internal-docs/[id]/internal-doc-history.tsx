import { FilePlus as FilePlus2, FileUp, PencilLine, Trash as Trash2 } from 'lucide-react'

import { formatDateTime } from '@/lib/utils'

export type InternalDocEvent = {
  id: string
  action: 'created' | 'updated' | 'file_replaced' | 'deleted'
  created_at: string
  actorName: string | null
  payload: Record<string, unknown>
}

const ACTION_META: Record<InternalDocEvent['action'], { label: string; Icon: typeof PencilLine }> =
  {
    created: { label: 'Creó el documento', Icon: FilePlus2 },
    updated: { label: 'Actualizó los detalles', Icon: PencilLine },
    file_replaced: { label: 'Reemplazó el archivo', Icon: FileUp },
    deleted: { label: 'Eliminó el documento', Icon: Trash2 },
  }

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  description: 'Descripción',
  category: 'Categoría',
  visibility: 'Visibilidad',
  tags: 'Etiquetas',
  effective_date: 'Vigencia',
  expires_at: 'Expiración',
}

/** Human-readable one-liner describing what changed in an event. */
function describe(event: InternalDocEvent): string | null {
  if (event.action === 'updated') {
    const changes = (event.payload.changes ?? {}) as Record<string, unknown>
    const fields = Object.keys(changes).map((f) => FIELD_LABELS[f] ?? f)
    return fields.length ? fields.join(', ') : null
  }
  if (event.action === 'file_replaced') {
    const to = event.payload.to as { version?: number } | undefined
    return to?.version ? `Nueva versión v${to.version}` : null
  }
  return null
}

/**
 * Append-only audit trail for an internal document. Renders the events as a
 * compact vertical timeline (most recent first).
 */
export function InternalDocHistory({ events }: { events: InternalDocEvent[] }) {
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">Sin actividad registrada todavía.</p>
  }

  return (
    <ol className="flex flex-col gap-4">
      {events.map((event) => {
        const meta = ACTION_META[event.action]
        const detail = describe(event)
        const Icon = meta.Icon
        return (
          <li key={event.id} className="flex gap-3">
            <span className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm">
                <span className="font-medium">{event.actorName ?? 'Alguien'}</span> ·{' '}
                {meta.label.toLowerCase()}
              </p>
              {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
              <time className="text-muted-foreground text-[11px] tabular-nums">
                {formatDateTime(event.created_at)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
