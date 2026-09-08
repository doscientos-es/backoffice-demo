import TaskDetailPage from '../../../tasks/[id]/page'
import { TaskQuickViewDialog } from '../../task-quick-view-dialog'

export const dynamic = 'force-dynamic'

export default async function TaskQuickViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <TaskQuickViewDialog taskId={id}>
      <TaskDetailPage
        params={Promise.resolve({ id })}
        searchParams={Promise.resolve({ display: 'dialog' })}
      />
    </TaskQuickViewDialog>
  )
}
