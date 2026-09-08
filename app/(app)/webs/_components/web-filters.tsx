'use client'

import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const TYPES = [
  { value: 'all', label: 'Todas' },
  { value: 'own', label: 'Propias' },
  { value: 'clients', label: 'Clientes' },
] as const

type TypeValue = (typeof TYPES)[number]['value']

export function WebFilters({
  q: initialQ,
  type: initialType,
  total,
}: {
  q: string
  type: string
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [q, setQ] = useState(initialQ)
  const commitRef = useRef<(q: string, type: string) => void>(() => {})

  commitRef.current = (search: string, type: string) => {
    const next = new URLSearchParams(params.toString())
    if (search) next.set('q', search)
    else next.delete('q')
    if (type !== 'all') next.set('type', type)
    else next.delete('type')
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  // Debounce search → URL
  useEffect(() => {
    if (q === initialQ) return
    const id = setTimeout(() => commitRef.current(q, initialType), 200)
    return () => clearTimeout(id)
  }, [q, initialQ, initialType])

  const setType = useCallback(
    (type: TypeValue) => commitRef.current(q, type),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  )

  const currentType = (TYPES.find((t) => t.value === initialType)?.value ?? 'all') as TypeValue

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative max-w-xs min-w-48 flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, URL o tech…"
          className={cn(
            'h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          )}
        />
      </div>

      {/* Type tabs */}
      <div className="border-border bg-muted/40 flex items-center gap-0.5 rounded-lg border p-0.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              currentType === t.value
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <span className="text-muted-foreground ml-auto text-xs tabular-nums">
        {total} {total === 1 ? 'sitio' : 'sitios'}
      </span>
    </div>
  )
}
