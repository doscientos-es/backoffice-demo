'use client'

import { Copy, Pencil, Plus, Power, Trash as Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { buildSignatureHtml } from '@/lib/email/signature'
import { appendSignature, markdownToHtml, renderTemplate } from '@/lib/email/templates'
import { formatDate } from '@/lib/utils'

import {
  createEmailTemplate,
  deleteEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
  toggleEmailTemplateActive,
  updateEmailTemplate,
} from './actions'

type Props = { templates: EmailTemplate[] }

const EMPTY_FORM: EmailTemplateInput = {
  name: '',
  slug: '',
  subject: '',
  body_html: '',
  include_signature: true,
}

/** Datos ficticios de un lead para previsualizar la plantilla en tiempo real. */
const SAMPLE_VARS: Record<string, string> = {
  nombre: 'María García',
  empresa: 'Acme Studio',
  email: 'maria.garcia@acme.com',
  sender_name: 'Pol Gubau',
}

/** Firma ficticia para la previsualización. */
const SAMPLE_SIGNATURE = buildSignatureHtml({
  name: 'Pol Gubau',
  jobTitle: 'Diseño y Estrategia',
  contactEmail: 'pol@doscientos.es',
  phone: '600 000 000',
})

export function EmailTemplatesManager({ templates }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState<EmailTemplateInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const previewSubject = useMemo(() => renderTemplate(form.subject, SAMPLE_VARS), [form.subject])
  const previewBody = useMemo(() => {
    const html = markdownToHtml(renderTemplate(form.body_html, SAMPLE_VARS))
    return form.include_signature ? appendSignature(html, SAMPLE_SIGNATURE) : html
  }, [form.body_html, form.include_signature])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setOpen(true)
  }

  function openEdit(tpl: EmailTemplate) {
    setEditing(tpl)
    setForm({
      name: tpl.name,
      slug: tpl.slug,
      subject: tpl.subject,
      body_html: tpl.body_html,
      include_signature: tpl.include_signature,
    })
    setError(null)
    setOpen(true)
  }

  /** Abre el formulario de creación precargado con los datos de una plantilla existente. */
  function openDuplicate(tpl: EmailTemplate) {
    setEditing(null)
    setForm({
      name: `${tpl.name} (copia)`,
      slug: `${tpl.slug}-copia`,
      subject: tpl.subject,
      body_html: tpl.body_html,
      include_signature: tpl.include_signature,
    })
    setError(null)
    setOpen(true)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = editing
        ? await updateEmailTemplate(editing.id, form)
        : await createEmailTemplate(form)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  function handleToggle(tpl: EmailTemplate) {
    startTransition(async () => {
      await toggleEmailTemplateActive(tpl.id, !tpl.active)
      router.refresh()
    })
  }

  function handleDelete(tpl: EmailTemplate) {
    const confirmed = window.confirm(
      `¿Eliminar la plantilla "${tpl.name}"?\n\nEsta acción no se puede deshacer.`,
    )
    if (!confirmed) return
    startTransition(async () => {
      const res = await deleteEmailTemplate(tpl.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 size-3.5" />
          Nueva plantilla
        </Button>
      </div>

      {templates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sin plantillas</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border-border overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nombre / Slug</th>
                <th className="px-4 py-2.5 font-medium">Asunto</th>
                <th className="px-4 py-2.5 font-medium">Variables</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Actualizado</th>
                <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr
                  key={tpl.id}
                  className="border-border hover:bg-muted/20 border-t transition-colors"
                >
                  <td className="px-4 py-2.5 align-middle">
                    <p className="font-medium">{tpl.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">{tpl.slug}</p>
                  </td>
                  <td className="text-muted-foreground max-w-55 truncate px-4 py-2.5 align-middle">
                    {tpl.subject}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {tpl.variables.map((v) => (
                        <Badge key={v} variant="neutral" className="font-mono text-[10px]">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <Badge variant={tpl.active ? 'success' : 'neutral'}>
                      {tpl.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 align-middle text-xs">
                    {formatDate(tpl.updated_at)}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(tpl)}
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDuplicate(tpl)}
                        title="Duplicar"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggle(tpl)}
                        title={tpl.active ? 'Desactivar' : 'Activar'}
                        disabled={isPending}
                      >
                        <Power className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(tpl)}
                        title="Eliminar"
                        disabled={isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <form onSubmit={handleSubmit} className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-border border-b px-5 py-4">
              <DialogTitle>{editing ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
              <DialogDescription>
                Edita los campos y comprueba a la derecha cómo se verá el email con un lead de
                ejemplo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
              {/* ── Columna de edición ── */}
              <div className="scroll-fade no-scrollbar flex flex-col gap-4 overflow-y-auto p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tpl-name">Nombre</Label>
                    <Input
                      id="tpl-name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Seguimiento de propuesta"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tpl-slug">Slug</Label>
                    <Input
                      id="tpl-slug"
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="seguimiento-propuesta"
                      required
                      disabled={!!editing}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-subject">Asunto</Label>
                  <Input
                    id="tpl-subject"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="Seguimiento: {{nombre}}"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-body">Cuerpo (Markdown)</Label>
                  <Textarea
                    id="tpl-body"
                    value={form.body_html}
                    onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))}
                    rows={16}
                    placeholder={'Hola **{{nombre}}**,\n\nGracias por tu interés…'}
                    required
                    className="min-h-80 font-mono text-xs"
                  />
                  <p className="text-muted-foreground text-xs">
                    Se escribe en Markdown (se convierte a HTML al previsualizar y enviar).
                    Variables disponibles: <code className="font-mono">{'{{nombre}}'}</code>{' '}
                    <code className="font-mono">{'{{empresa}}'}</code>{' '}
                    <code className="font-mono">{'{{email}}'}</code>{' '}
                    <code className="font-mono">{'{{sender_name}}'}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tpl-sig"
                  isSelected={form.include_signature}
                  onChange={(v) => setForm((f) => ({ ...f, include_signature: v }))}
                  />
                  <Label htmlFor="tpl-sig" className="cursor-pointer">
                    Añadir firma del remitente
                  </Label>
                </div>
              </div>

              {/* ── Columna de vista previa en tiempo real ── */}
              <div className="border-border bg-muted/30 scroll-fade no-scrollbar flex flex-col gap-3 overflow-y-auto border-t p-5 lg:border-t-0 lg:border-l">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs font-medium">
                    Vista previa en tiempo real
                  </p>
                  <Badge variant="neutral" className="text-[10px]">
                    Lead de ejemplo
                  </Badge>
                </div>

                <div className="border-border rounded-lg border bg-white shadow-sm">
                  <div className="space-y-1 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                    <p className="text-[10px] tracking-wide text-neutral-400 uppercase">Asunto</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {previewSubject || (
                        <span className="text-neutral-400 italic">(sin asunto)</span>
                      )}
                    </p>
                  </div>
                  <div className="min-h-40 px-4 py-3 text-sm text-neutral-800">
                    {form.body_html.trim() ? (
                      <div
                        className="[&_a]:text-[#2A4227] [&_a]:underline"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: vista previa con datos internos de ejemplo
                        dangerouslySetInnerHTML={{ __html: previewBody }}
                      />
                    ) : (
                      <p className="text-neutral-400 italic">El cuerpo del email aparecerá aquí…</p>
                    )}
                  </div>
                </div>

                <div className="border-border text-muted-foreground rounded-md border border-dashed p-3 text-[11px]">
                  <p className="text-foreground/80 mb-1 font-medium">Datos del lead de ejemplo</p>
                  <ul className="space-y-0.5">
                    <li>
                      <code className="font-mono">{'{{nombre}}'}</code> → {SAMPLE_VARS.nombre}
                    </li>
                    <li>
                      <code className="font-mono">{'{{empresa}}'}</code> → {SAMPLE_VARS.empresa}
                    </li>
                    <li>
                      <code className="font-mono">{'{{email}}'}</code> → {SAMPLE_VARS.email}
                    </li>
                    <li>
                      <code className="font-mono">{'{{sender_name}}'}</code> →{' '}
                      {SAMPLE_VARS.sender_name}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-border bg-muted/40 flex items-center justify-end gap-2 border-t px-5 py-3">
              {error && <p className="text-destructive mr-auto text-sm">{error}</p>}
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <SubmitButton loading={isPending}>
                {editing ? 'Guardar cambios' : 'Crear plantilla'}
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
