'use client'

import { FolderGit2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Textarea } from '@/components/ui/textarea'

import { updateProjectWorkspacePaths } from '../actions'

export function WorkspacePathsForm({
  projectId,
  version,
  paths,
  canEdit,
}: {
  projectId: string
  version: number
  paths: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [value, setValue] = useState(paths.join('\n'))

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    const workspacePaths = value
      .split(/\r?\n|,/)
      .map((path) => path.trim())
      .filter(Boolean)
    const result = await updateProjectWorkspacePaths({
      id: projectId,
      expected_version: version,
      workspace_paths: workspacePaths,
    })
    if (!result.ok) return feedback.setError(result.error)
    feedback.setSuccess('Rutas guardadas')
    router.refresh()
  }

  return (
    <div className="grid gap-3">
      <div className="text-muted-foreground flex items-start gap-3 text-sm">
        <FolderGit2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Una ruta por línea, relativa a la raíz del workspace. Funciona igual aunque cada persona
          clone o mueva el monorepo a una ubicación distinta.
        </p>
      </div>
      {canEdit ? (
        <form onSubmit={handleSubmit} className="grid gap-3">
          <Textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={Math.max(3, paths.length + 1)}
            maxLength={5000}
            placeholder={'clients/transporte-mascotas\ninternal/backoffice'}
            aria-label="Rutas de código del proyecto"
          />
          <div className="flex items-center justify-between gap-3">
            <FormFeedback state={feedback.state} />
            <Button type="submit" size="sm" disabled={feedback.pending}>
              {feedback.pending ? 'Guardando…' : 'Guardar rutas'}
            </Button>
          </div>
        </form>
      ) : paths.length > 0 ? (
        <ul className="grid gap-1 font-mono text-xs">
          {paths.map((path) => (
            <li key={path}>{path}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Sin rutas configuradas.</p>
      )}
    </div>
  )
}
