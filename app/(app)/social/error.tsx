'use client'

import { TriangleAlert as AlertTriangle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function SocialError({
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
        <h1 className="text-xl font-semibold">Error al cargar social</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          No se han podido cargar las publicaciones y conexiones sociales. Inténtalo de nuevo.
        </p>
        {error.digest && <p className="text-muted-foreground text-xs">ID: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">
          Reintentar
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inicio">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  )
}
