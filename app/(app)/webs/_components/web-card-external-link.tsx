'use client'

import { ExternalLink } from 'lucide-react'

export function WebCardExternalLink({ url, name }: { url: string; name: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1.5 opacity-0 transition-all group-hover:opacity-100"
      aria-label={`Abrir ${name}`}
      title="Abrir en nueva pestaña"
    >
      <ExternalLink className="size-3.5" />
    </a>
  )
}
