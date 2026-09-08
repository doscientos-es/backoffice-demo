'use client'

import { useState } from 'react'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useOptimisticRemoval } from '@/lib/hooks/use-optimistic-removal'

import { deleteProject } from './actions'
import { ProjectQuickView, type QuickProject } from './project-quick-view'

export function ProjectsList({ canEdit = false, ...props }: ListPageProps & { canEdit?: boolean }) {
  const [selectedProject, setSelectedProject] = useState<QuickProject | null>(null)
  const { items: rows, remove } = useOptimisticRemoval(props.rows)

  const handleDelete = (id: string) => {
    // Close the drawer immediately; the row vanishes optimistically and
    // reappears (with a toast) if the server rejects the delete.
    setSelectedProject(null)
    remove(id, () => deleteProject({ id }), {
      errorMessage: 'No se pudo eliminar el proyecto',
    })
  }

  return (
    <>
      <ListPage
        {...props}
        rows={rows}
        onRowClick={(row) => setSelectedProject(row.data as QuickProject)}
      />
      <ErrorBoundary>
        <ProjectQuickView
          project={selectedProject}
          canEdit={canEdit}
          onDeleteAction={handleDelete}
          onCloseAction={() => setSelectedProject(null)}
        />
      </ErrorBoundary>
    </>
  )
}
