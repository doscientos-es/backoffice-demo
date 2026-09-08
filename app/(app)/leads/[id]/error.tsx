'use client'

import { TriangleAlert as AlertTriangle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

/** Catches errors thrown while rendering an individual lead detail page. */
export default function LeadDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="bg-destructive/10 flex size-16 items-center justify-center rounded-2xl">
        <AlertTriangle className="text-destructive size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Error al cargar el lead</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          No se ha podido cargar esta ficha. Inténtalo de nuevo o vuelve a los leads.
        </p>
        {error.digest && <p className="text-muted-foreground text-xs">ID: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">
          Reintentar
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/leads">Volver a leads</Link>
        </Button>
      </div>
    </div>
  )
}
