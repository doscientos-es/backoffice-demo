import type { MyDayData } from '@/lib/dashboard/types'

export type MyDayScope = {
  canViewTeam: boolean
  value: string
  label: string
  members: Array<{ id: string; name: string }>
}

export type MyDayPanelProps = MyDayData & { scope: MyDayScope }
