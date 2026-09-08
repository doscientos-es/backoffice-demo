'use client'

import { Link as Link2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'

import { linkProposalToProject } from '../../proposals/actions'

type Proposal = { id: string; number: string | null; title: string | null }

interface Props {
  projectId: string
  unlinkdProposals: Proposal[]
}

/**
 * Inline widget in the project "Propuestas" card to link an existing proposal
 * (one that has no project_id yet) to this project.
 */
export function LinkProposalButton({ projectId, unlinkdProposals }: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 3000 })
  const [pending, startTransition] = useTransition()
  const [picking, setPicking] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')

  if (unlinkdProposals.length === 0) return null

  function handleLink() {
    if (!selectedId) return
    feedback.setPending()
    startTransition(async () => {
      const res = await linkProposalToProject({ proposal_id: selectedId, project_id: projectId })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess('Propuesta vinculada')
      setPicking(false)
      setSelectedId('')
      router.refresh()
    })
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
          {unlinkdProposals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number ? `${p.number} · ` : ''}
              {p.title ?? p.id}
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
      <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
        <Link2 className="size-3.5" />
        Vincular existente
      </Button>
      <FormFeedback state={feedback.state} />
    </div>
  )
}
