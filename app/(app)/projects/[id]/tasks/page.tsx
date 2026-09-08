import { redirect } from 'next/navigation'

export default async function ProjectKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/projects/${id}?tasks_view=board`)
}
