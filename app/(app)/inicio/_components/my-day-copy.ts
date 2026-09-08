import type { MyDayScope } from './my-day-types'

export function isTeamScope(scope: MyDayScope): boolean {
  return scope.value === 'team'
}

export function getMyDayLeadsCopy(scope: MyDayScope): { title: string; empty: string } {
  if (isTeamScope(scope)) {
    return {
      title: 'Leads del equipo',
      empty: 'El equipo no tiene leads activos asignados.',
    }
  }

  if (scope.value) {
    return {
      title: `Leads de ${scope.label}`,
      empty: `${scope.label} no tiene leads activos asignados.`,
    }
  }

  return { title: 'Tus leads', empty: 'No tienes leads activos asignados.' }
}
