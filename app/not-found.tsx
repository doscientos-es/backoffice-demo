import { Search as SearchX } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const metadata = { title: 'Página no encontrada · doscientos' }

export default function GlobalNotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
        <SearchX className="text-muted-foreground size-8" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Error 404
        </p>
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          La URL que has introducido no existe o ha sido movida. Comprueba que el enlace es
          correcto.
        </p>
      </div>

      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
