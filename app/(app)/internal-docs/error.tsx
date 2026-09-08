'use client'

import { TriangleAlert as AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function InternalDocsError({
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
        <h1 className="text-xl font-semibold">Error al cargar los documentos</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          No se han podido cargar los documentos internos. Inténtalo de nuevo.
        </p>
        {error.digest && <p className="text-muted-foreground text-xs">ID: {error.digest}</p>}
      </div>
      <Button onClick={reset} size="sm">
        Reintentar
      </Button>
    </div>
  )
}
