'use client'

import { Link as Link2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'

import { linkProposalToProject } from '../actions'

type Project = { id: string; name: string }

interface Props {
  proposalId: string
  currentProject: Project | null
  availableProjects: Project[]
}

/**
 * Inline widget inside the "Información" card that lets the team link or
 * unlink a project to/from a proposal at any time after creation.
 */
export function LinkProjectButton({ proposalId, currentProject, availableProjects }: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 3000 })
  const [pending, startTransition] = useTransition()
  const [picking, setPicking] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')

  function handleLink() {
    if (!selectedId) return
    feedback.setPending()
    startTransition(async () => {
      const res = await linkProposalToProject({ proposal_id: proposalId, project_id: selectedId })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess('Proyecto vinculado')
      setPicking(false)
      setSelectedId('')
      router.refresh()
    })
  }

  function handleUnlink() {
    feedback.setPending()
    startTransition(async () => {
      const res = await linkProposalToProject({ proposal_id: proposalId, project_id: null })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess('Proyecto desvinculado')
      router.refresh()
    })
  }

  if (currentProject) {
    return (
      <div className="flex items-center gap-2">
        <Link href={`/projects/${currentProject.id}`} className="hover:underline">
          {currentProject.name}
        </Link>
        <FormFeedback state={feedback.state} />
        <button
          type="button"
          onClick={handleUnlink}
          disabled={pending}
          aria-label="Desvincular proyecto"
          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  if (picking) {
    return (
      <div className="flex items-center gap-2">
        <select
          className="border-input bg-background h-7 rounded-md border px-2 text-xs"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {availableProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="default" onClick={handleLink} disabled={!selectedId || pending}>
          Vincular
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPicking(false)} disabled={pending}>
          Cancelar
        </Button>
        <FormFeedback state={feedback.state} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">—</span>
      {availableProjects.length > 0 ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setPicking(true)}
        >
          <Link2 className="size-3" />
          Vincular
        </Button>
      ) : null}
      <FormFeedback state={feedback.state} />
    </div>
  )
}
