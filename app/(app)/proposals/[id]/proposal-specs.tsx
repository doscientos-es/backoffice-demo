'use client'

import { Eye, EyeOff, Pencil, Save, Sparkle as Sparkles, Trash as Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { AiNotice } from '@/components/ui/ai-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { Textarea } from '@/components/ui/textarea'
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'

import { deleteSpec, toggleSpecVisibility, updateSpec } from './spec-actions'

export type ProposalSpec = {
  id: string
  title: string
  body_markdown: string
  is_client_visible: boolean
  portal_token: string | null
  updated_at: string
  version: number
}

type Props = {
  proposalId: string
  specs: ProposalSpec[]
  aiEnabled: boolean
  locked: boolean
}

export function ProposalSpecs({ proposalId, specs, aiEnabled, locked }: Props) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    feedback.setPending()
    try {
      const res = await fetch(`/api/proposals/${proposalId}/generate-spec`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo generar la spec.')
      feedback.setSuccess('Documentación generada')
      router.refresh()
    } catch (err) {
      feedback.setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Documentación técnica</h3>
          <p className="text-muted-foreground text-xs">
            Documentos que se enviarán junto a la propuesta y aparecerán en el portal del cliente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Generando…" />
          {aiEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={generating || locked}
            >
              <Sparkles className="size-3.5" />
              {generating ? 'Generando…' : 'Generar con IA'}
            </Button>
          ) : (
            <AiNotice inline />
          )}
        </div>
      </div>

      {specs.length === 0 ? (
        <p className="border-border bg-muted/30 text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-xs">
          Aún no hay documentación técnica. Genera una con IA para tener una base que editar antes
          de enviar la propuesta.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {specs.map((spec) => (
            <SpecRow key={`${spec.id}-${spec.version}`} spec={spec} locked={locked} />
          ))}
        </ul>
      )}
    </div>
  )
}

function SpecRow({ spec, locked }: { spec: ProposalSpec; locked: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(spec.title)
  const [body, setBody] = useState(spec.body_markdown)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const feedback = useFormFeedback()
  const [deleting, startTransition] = useTransition()

  async function handleSave() {
    feedback.setPending()
    const res = await updateSpec({
      id: spec.id,
      expected_version: spec.version,
      title,
      body_markdown: body,
    })
    if (res.ok) {
      feedback.setSuccess('Guardado')
      setEditing(false)
      startTransition(() => router.refresh())
    } else if (res.code === 'conflict') setConflictOpen(true)
    else feedback.setError(res.error)
  }

  async function handleToggle() {
    feedback.setPending()
    const res = await toggleSpecVisibility({
      id: spec.id,
      expected_version: spec.version,
      is_client_visible: !spec.is_client_visible,
    })
    if (res.ok) {
      feedback.setSuccess(spec.is_client_visible ? 'Ocultada' : 'Visible para cliente')
      startTransition(() => router.refresh())
    } else if (res.code === 'conflict') setConflictOpen(true)
    else feedback.setError(res.error)
  }

  // Hard delete (irreversible): a `proposal_specs` row is removed permanently,
  // so this keeps an explicit ConfirmDialog rather than the undo-toast pattern.
  function handleDelete() {
    feedback.setPending()
    setConfirmDelete(false)
    startTransition(async () => {
      const res = await deleteSpec({ id: spec.id })
      if (res.ok) router.refresh()
      else feedback.setError(res.error)
    })
  }

  return (
    <li className="border-border bg-background flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm font-medium"
            />
          ) : (
            <p className="truncate text-sm font-medium">{spec.title}</p>
          )}
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Badge variant={spec.is_client_visible ? 'success' : 'neutral'}>
              {spec.is_client_visible ? 'Visible cliente' : 'Privada'}
            </Badge>
            {spec.is_client_visible && spec.portal_token ? (
              <a
                href={`/p/spec/${spec.portal_token}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Ver enlace público
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FormFeedback state={feedback.state} />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleToggle}
            disabled={locked}
            aria-label="Visibilidad"
          >
            {spec.is_client_visible ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
          {editing ? (
            <Button size="sm" variant="default" onClick={handleSave} disabled={locked}>
              <Save className="size-3.5" /> Guardar
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              disabled={locked}
              aria-label="Editar"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={locked || deleting}
            aria-label="Eliminar"
          >
            <Trash2 className="text-destructive size-3.5" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar esta documentación?"
        description="Esta acción es permanente y no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
      />
      <VersionConflictDialog
        open={conflictOpen}
        entityName="documento técnico"
        onKeepEditing={() => setConflictOpen(false)}
        onReload={() => {
          setConflictOpen(false)
          router.refresh()
        }}
      />

      {editing ? (
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={20}
          className="font-mono text-xs"
          placeholder="Contenido en markdown…"
        />
      ) : (
        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
            Ver contenido
          </summary>
          <div className="border-border bg-muted/20 mt-3 rounded-md border p-4">
            <Markdown source={spec.body_markdown} />
          </div>
        </details>
      )}
    </li>
  )
}
