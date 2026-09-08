'use client'

import { LoaderCircle as Loader2, Paperclip } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { todayIsoLocal } from '@/lib/utils/date'

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

export function UploadForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Avoid SSR/client hydration mismatch: set today's date after mount only.
  const [effectiveDate, setEffectiveDate] = useState('')
  useEffect(() => {
    setEffectiveDate(todayIsoLocal())
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo')
      return
    }

    formData.set('file', file)

    setUploading(true)
    try {
      const res = await fetch('/api/internal-docs/upload', {
        method: 'POST',
        body: formData,
      })
      const json = (await res.json()) as { id?: string; error?: string }

      if (!res.ok || !json.id) {
        setError(json.error ?? 'Error al subir el documento')
        return
      }

      router.push(`/internal-docs/${json.id}`)
    } catch {
      setError('Error de red. Inténtalo de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* File picker */}
      <FormRow label="Archivo" htmlFor="file" required>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            id="file"
            name="file"
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            required
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-3.5" />
            Seleccionar archivo
          </Button>
          {fileName ? (
            <span className="text-muted-foreground max-w-xs truncate text-sm">{fileName}</span>
          ) : (
            <span className="text-muted-foreground text-sm">
              Máx. 50 MB · PDF, Word, Excel, imagen
            </span>
          )}
        </div>
      </FormRow>

      <FormRow label="Nombre del documento" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          placeholder="Contrato marco de servicios 2026"
        />
      </FormRow>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Categoría" htmlFor="category">
          <Select id="category" name="category" defaultValue="other">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Visibilidad" htmlFor="visibility">
          <Select id="visibility" name="visibility" defaultValue="all_team">
            <option value="all_team">Todo el equipo</option>
            <option value="admins_only">Solo admins</option>
          </Select>
        </FormRow>

        <FormRow
          label="Fecha de vigencia"
          htmlFor="effective_date"
          hint="Prerrellenada con hoy. Cámbiala si aplica otra fecha."
        >
          <DateField
            id="effective_date"
            name="effective_date"
            value={effectiveDate}
            onChange={setEffectiveDate}
          />
        </FormRow>

        <FormRow
          label="Fecha de expiración"
          htmlFor="expires_at"
          hint="Opcional. Déjala vacía si el documento no caduca."
        >
          <DateField id="expires_at" name="expires_at" defaultValue="" />
        </FormRow>
      </div>

      <FormRow label="Descripción" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          maxLength={2000}
          rows={3}
          placeholder="Breve descripción del contenido…"
        />
      </FormRow>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}

      <div className="border-border flex items-center justify-end gap-2 border-t pt-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/internal-docs">Cancelar</Link>
        </Button>
        <Button type="submit" size="sm" disabled={uploading}>
          {uploading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Subiendo…
            </>
          ) : (
            'Subir documento'
          )}
        </Button>
      </div>
    </form>
  )
}
