'use client'

import { Paperclip, Pencil, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import {
  INTERNAL_DOC_MAX_TAGS,
  type InternalDocCategory,
  type InternalDocVisibility,
} from '@/lib/schemas/internal-doc'

import { updateInternalDoc } from '../actions'

const CATEGORIES = [
  { value: 'legal', label: 'Legal' },
  { value: 'hr', label: 'RRHH' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'templates', label: 'Plantillas' },
  { value: 'policies', label: 'Políticas' },
  { value: 'meetings', label: 'Actas' },
  { value: 'other', label: 'Otro' },
] as const

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg'

type DocValues = {
  id: string
  name: string
  description: string | null
  category: InternalDocCategory
  visibility: InternalDocVisibility
  tags: string[]
  effective_date: string | null
  expires_at: string | null
}

/**
 * Edit dialog for an internal document. Metadata (name, description, category,
 * visibility, tags, dates) is saved through the `updateInternalDoc` action;
 * an optional new file is sent to `/api/internal-docs/[id]/replace`. Visibility
 * is only editable by admins (`canEditVisibility`).
 */
export function InternalDocEditDialog({
  doc,
  canEditVisibility,
}: {
  doc: DocValues
  canEditVisibility: boolean
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [tags, setTags] = useState<string[]>(doc.tags ?? [])
  const [draft, setDraft] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)

  function addTag(raw: string) {
    const value = raw.trim().slice(0, 40)
    if (!value || tags.includes(value) || tags.length >= INTERNAL_DOC_MAX_TAGS) return
    setTags((prev) => [...prev, value])
    setDraft('')
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()

    // Replace the underlying file first (if a new one was picked) so the
    // metadata save still runs even when the file is unchanged.
    const file = fileRef.current?.files?.[0]
    if (file) {
      const body = new FormData()
      body.set('file', file)
      const res = await fetch(`/api/internal-docs/${doc.id}/replace`, { method: 'POST', body })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        return feedback.setError(json.error ?? 'No se pudo reemplazar el archivo')
      }
    }

    const result = await updateInternalDoc({
      id: doc.id,
      name: fd.get('name')?.toString() ?? '',
      description: fd.get('description')?.toString() ?? '',
      category: (fd.get('category')?.toString() ?? doc.category) as DocValues['category'],
      visibility: (canEditVisibility
        ? (fd.get('visibility')?.toString() ?? doc.visibility)
        : doc.visibility) as DocValues['visibility'],
      tags,
      effective_date: fd.get('effective_date')?.toString() ?? '',
      expires_at: fd.get('expires_at')?.toString() ?? '',
    })

    if (!result.ok) return feedback.setError(result.error)
    feedback.setSuccess('Guardado')
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          feedback.reset()
          setTags(doc.tags ?? [])
          setDraft('')
          setFileName(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
          <DialogDescription>
            Actualiza los detalles, etiquetas o reemplaza el archivo.
          </DialogDescription>
        </DialogHeader>
        <InternalDocEditForm
          doc={doc}
          canEditVisibility={canEditVisibility}
          tags={tags}
          draft={draft}
          fileName={fileName}
          fileRef={fileRef}
          feedbackState={feedback.state}
          onSubmit={onSubmit}
          onDraftChange={setDraft}
          onTagKeyDown={onTagKeyDown}
          onAddTag={() => addTag(draft)}
          onRemoveTag={(t) => setTags((prev) => prev.filter((x) => x !== t))}
          onFileChange={(n) => setFileName(n)}
        />
      </DialogContent>
    </Dialog>
  )
}

type EditFormProps = {
  doc: DocValues
  canEditVisibility: boolean
  tags: string[]
  draft: string
  fileName: string | null
  fileRef: React.RefObject<HTMLInputElement | null>
  feedbackState: ReturnType<typeof useFormFeedback>['state']
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onDraftChange: (value: string) => void
  onTagKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
  onFileChange: (name: string | null) => void
}

function InternalDocEditForm({
  doc,
  canEditVisibility,
  tags,
  draft,
  fileName,
  fileRef,
  feedbackState,
  onSubmit,
  onDraftChange,
  onTagKeyDown,
  onAddTag,
  onRemoveTag,
  onFileChange,
}: EditFormProps) {
  const pending = feedbackState.status === 'pending'
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormRow label="Nombre del documento" htmlFor="edit-name" required>
        <Input id="edit-name" name="name" required maxLength={200} defaultValue={doc.name} />
      </FormRow>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Categoría" htmlFor="edit-category">
          <Select id="edit-category" name="category" defaultValue={doc.category}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow
          label="Visibilidad"
          htmlFor="edit-visibility"
          hint={canEditVisibility ? undefined : 'Solo un administrador puede cambiarla.'}
        >
          <Select
            id="edit-visibility"
            name="visibility"
            defaultValue={doc.visibility}
            disabled={!canEditVisibility}
          >
            <option value="all_team">Todo el equipo</option>
            <option value="admins_only">Solo admins</option>
          </Select>
        </FormRow>

        <FormRow label="Fecha de vigencia" htmlFor="edit-effective_date">
          <Input
            id="edit-effective_date"
            name="effective_date"
            type="date"
            defaultValue={doc.effective_date ?? ''}
          />
        </FormRow>

        <FormRow label="Fecha de expiración" htmlFor="edit-expires_at">
          <Input
            id="edit-expires_at"
            name="expires_at"
            type="date"
            defaultValue={doc.expires_at ?? ''}
          />
        </FormRow>
      </div>

      <FormRow
        label="Etiquetas"
        htmlFor="edit-tags"
        hint={`Pulsa Intro o coma para añadir. Máx. ${INTERNAL_DOC_MAX_TAGS}.`}
      >
        {tags.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="text-muted-foreground/70 hover:text-foreground"
                  aria-label={`Quitar etiqueta ${tag}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          id="edit-tags"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={onAddTag}
          maxLength={40}
          placeholder="contrato, 2026…"
        />
      </FormRow>

      <FormRow label="Descripción" htmlFor="edit-description">
        <Textarea
          id="edit-description"
          name="description"
          maxLength={2000}
          rows={3}
          defaultValue={doc.description ?? ''}
        />
      </FormRow>

      <FormRow
        label="Reemplazar archivo"
        htmlFor="edit-file"
        hint="Opcional. Sube una nueva versión; la anterior se sustituye."
      >
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            id="edit-file"
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(e) => onFileChange(e.target.files?.[0]?.name ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-3.5" aria-hidden />
            Seleccionar archivo
          </Button>
          <span className="text-muted-foreground max-w-48 truncate text-sm">
            {fileName ?? 'Sin cambios'}
          </span>
        </div>
      </FormRow>

      <DialogFooter className="items-center">
        <FormFeedback state={feedbackState} />
        <SubmitButton loading={pending} pendingLabel="Guardando…">
          Guardar cambios
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
