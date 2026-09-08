import { describe, expect, it } from 'vitest'

import { getMyDayLeadsCopy, isTeamScope } from './my-day-copy'

const scope = {
  canViewTeam: true,
  value: '',
  label: 'Mis tareas',
  members: [],
}

describe('my day leads copy', () => {
  it('uses the personal copy when no team scope is selected', () => {
    expect(getMyDayLeadsCopy(scope)).toEqual({
      title: 'Tus leads',
      empty: 'No tienes leads activos asignados.',
    })
  })

  it('uses team and member-specific copy', () => {
    expect(getMyDayLeadsCopy({ ...scope, value: 'team' })).toEqual({
      title: 'Leads del equipo',
      empty: 'El equipo no tiene leads activos asignados.',
    })
    expect(getMyDayLeadsCopy({ ...scope, value: 'member-1', label: 'Ada' })).toEqual({
      title: 'Leads de Ada',
      empty: 'Ada no tiene leads activos asignados.',
    })
    expect(isTeamScope({ ...scope, value: 'team' })).toBe(true)
  })
})
