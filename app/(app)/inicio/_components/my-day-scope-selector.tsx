'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Select } from '@/components/ui/select'

import type { MyDayScope } from './my-day-types'

export function MyDayScopeSelector({ scope }: { scope: MyDayScope }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateScope(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('member', value)
    else params.delete('member')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <Select
      value={scope.value}
      onChange={(event) => updateScope(event.target.value)}
      aria-label="Mostrar acciones de"
      className="h-8 min-w-40 text-xs"
    >
      <option value="">Mis tareas</option>
      <option value="team">Equipo completo</option>
      {scope.members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </Select>
  )
}
