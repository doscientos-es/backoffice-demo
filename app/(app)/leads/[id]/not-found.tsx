import { CircleUser as UserRoundX } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function LeadNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
        <UserRoundX className="text-muted-foreground size-8" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Lead no encontrado</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Este lead no existe o ha sido eliminado. Puede que el enlace sea incorrecto o que el
          registro ya no esté disponible.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/leads">Ver todos los leads</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/leads/new">Crear lead nuevo</Link>
        </Button>
      </div>
    </div>
  )
}
