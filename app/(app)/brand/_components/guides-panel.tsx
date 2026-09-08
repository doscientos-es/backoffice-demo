'use client'

import { Pencil, Plus, Trash as Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { deleteGuide, upsertGuide } from '../actions'

export type BrandGuide = {
  id: string
  slug: string
  title: string
  description: string | null
  content: string
  status: 'draft' | 'published' | 'archived'
  sort_order: number
  published_at: string | null
}

const STATUS_LABELS: Record<BrandGuide['status'], string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
}

function GuideDialog({
  guide,
  open,
  onOpenChange,
}: {
  guide: BrandGuide | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await upsertGuide({
        id: guide?.id,
        slug: String(form.get('slug') ?? '').trim(),
        title: String(form.get('title') ?? '').trim(),
        description: String(form.get('description') ?? '').trim() || undefined,
        content: String(form.get('content') ?? '').trim(),
        status: form.get('status') as BrandGuide['status'],
        sort_order: Number(form.get('sort_order') ?? 0),
      })
      if (result.ok) onOpenChange(false)
      else alert(result.error ?? 'No se pudo guardar la guía')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{guide ? 'Editar guía' : 'Nueva guía'}</DialogTitle>
        </DialogHeader>
        <form key={guide?.id ?? 'new'} onSubmit={submit} className="mt-2 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Título" htmlFor="guide-title" required>
              <Input
                id="guide-title"
                name="title"
                required
                maxLength={120}
                defaultValue={guide?.title}
              />
            </FormRow>
            <FormRow label="Slug" htmlFor="guide-slug" required>
              <Input
                id="guide-slug"
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={80}
                placeholder="voz-y-tono"
                defaultValue={guide?.slug}
              />
            </FormRow>
          </div>
          <FormRow label="Descripción" htmlFor="guide-description">
            <Input
              id="guide-description"
              name="description"
              maxLength={300}
              defaultValue={guide?.description ?? ''}
            />
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Estado" htmlFor="guide-status" required>
              <Select id="guide-status" name="status" defaultValue={guide?.status ?? 'draft'}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Orden" htmlFor="guide-order" required>
              <Input
                id="guide-order"
                name="sort_order"
                type="number"
                min="0"
                required
                defaultValue={guide?.sort_order ?? 0}
              />
            </FormRow>
          </div>
          <FormRow label="Contenido" htmlFor="guide-content" required>
            <Textarea
              id="guide-content"
              name="content"
              required
              rows={12}
              maxLength={12000}
              placeholder="Escribe una guía clara, con párrafos y listas sencillas."
              defaultValue={guide?.content ?? ''}
            />
          </FormRow>
          <div className="border-border flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar guía'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GuidesPanel({ guides, isAdmin }: { guides: BrandGuide[]; isAdmin: boolean }) {
  const [selected, setSelected] = useState<BrandGuide | null | undefined>(undefined)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <div className="flex flex-col gap-3">
        {isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setSelected(null)}>
              <Plus className="size-3.5" />
              Nueva guía
            </Button>
          </div>
        )}
        {guides.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Aún no hay guías editoriales.
          </p>
        ) : (
          guides.map((guide) => (
            <article key={guide.id} className="border-border bg-card rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{guide.title}</h3>
                    <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                      {STATUS_LABELS[guide.status]}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    /{guide.slug}
                    {guide.description ? ` · ${guide.description}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Editar"
                      onClick={() => setSelected(guide)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      disabled={pending}
                      title="Eliminar"
                      onClick={() => {
                        if (!confirm(`¿Eliminar “${guide.title}”?`)) return
                        startTransition(async () => {
                          await deleteGuide({ id: guide.id })
                        })
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      <GuideDialog
        guide={selected ?? null}
        open={selected !== undefined}
        onOpenChange={(open) => !open && setSelected(undefined)}
      />
    </>
  )
}
