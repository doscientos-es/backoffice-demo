import { requireUser } from '@/lib/auth'
import { getMyDay } from '@/lib/dashboard/queries'
import { listActiveMembers } from '@/lib/members/queries'

import { MyDayPanel } from '../my-day-panel'

export async function MyDayWidget({ member }: { member?: string | string[] }) {
  const user = await requireUser()
  const canViewTeam = user.role === 'owner' || user.role === 'admin'
  const members = canViewTeam ? await listActiveMembers() : []
  const requestedMember = typeof member === 'string' ? member : ''
  const selectedMember = members.find((candidate) => candidate.id === requestedMember)
  const teamSelected = canViewTeam && requestedMember === 'team'
  const assigneeId = teamSelected ? null : (selectedMember?.id ?? user.id)
  const selectedName = teamSelected
    ? 'Equipo completo'
    : (selectedMember?.name ?? (assigneeId === user.id ? 'Mis tareas' : user.name))
  const data = await getMyDay({ assigneeId })

  return (
    <MyDayPanel
      {...data}
      scope={{
        canViewTeam,
        value: teamSelected ? 'team' : (selectedMember?.id ?? ''),
        label: selectedName,
        members: members.map(({ id, name }) => ({ id, name })),
      }}
    />
  )
}
