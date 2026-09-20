import { GripVertical } from 'lucide-react'

export function KanbanDragHandle({ label, setActivatorNodeRef, attributes, listeners }: { label: string; setActivatorNodeRef: (element: HTMLElement | null) => void; attributes: object; listeners: object | undefined }) {
  return <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Arrastrar ${label}`} title={`Arrastrar ${label}`} className="text-muted-foreground/45 hover:text-foreground focus-visible:ring-ring/50 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"><GripVertical className="size-4" aria-hidden /></button>
}
