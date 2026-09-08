'use client'

import { TriangleAlert as AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-4 my-10 flex min-h-[28rem] flex-col items-center justify-center gap-6 rounded-[1.75rem] border border-black/[0.07] bg-white px-6 py-16 text-center shadow-sm sm:mx-6 dark:border-white/[0.09] dark:bg-[#181b17]">
      <div className="bg-destructive/10 ring-destructive/10 flex size-16 items-center justify-center rounded-2xl ring-1">
        <AlertTriangle className="text-destructive size-8" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          No hemos podido mostrar el documento
        </h1>
        <p className="text-muted-foreground max-w-md text-sm leading-6">
          Ha ocurrido un problema al cargar esta página. Vuelve a intentarlo y, si el problema
          persiste, ponte en contacto con quien te envió el enlace.
        </p>
        {error.digest && <p className="text-muted-foreground text-xs">ID: {error.digest}</p>}
      </div>

      <Button onClick={() => reset()} size="lg" className="rounded-xl px-4">
        Reintentar
      </Button>
    </div>
  )
}
