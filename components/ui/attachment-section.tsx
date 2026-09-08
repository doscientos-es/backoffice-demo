'use client'

import { IconButton } from '@doscientos/ui'
import {
  Camera,
  Download,
  ExternalLink,
  LoaderCircle as Loader2,
  Paperclip,
  Upload as UploadCloud,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type AttachmentItem = {
  id: string
  name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  source?: 'storage' | 'drive' | null
  web_view_link?: string | null
}

type EntityType = 'lead' | 'project' | 'proposal' | 'client' | 'expense'

interface Props {
  entityType: EntityType
  entityId: string
  attachments: AttachmentItem[]
  canEdit: boolean
  title?: string
}

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

/** Official Google Drive product mark. It is only resized, as permitted by Google. */
function GoogleDriveIcon() {
  return (
    <svg viewBox="0 0 87.3 78" className="size-4" aria-hidden="true" focusable="false">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  )
}

export function AttachmentSection({
  entityType,
  entityId,
  attachments,
  canEdit,
  title = 'Adjuntos',
}: Props) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Tracks nested dragenter/dragleave so the overlay doesn't flicker over children.
  const dragDepth = useRef(0)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [driveDialogOpen, setDriveDialogOpen] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [driveLinking, setDriveLinking] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  /** Uploads a single file; resolves to an error message or null on success. */
  async function uploadFile(file: File): Promise<string | null> {
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('entityType', entityType)
      formData.set('entityId', entityId)

      const res = await fetch('/api/attachments/upload', { method: 'POST', body: formData })
      const json = (await res.json()) as { id?: string; error?: string }

      if (!res.ok || !json.id) return json.error ?? 'Error al subir'
      return null
    } catch {
      return 'Error de red'
    }
  }

  /** Uploads files sequentially, reporting per-file failures. Shared by the button and drop zone. */
  async function uploadFiles(files: File[]) {
    if (files.length === 0 || uploading) return

    setErrors([])
    setUploading(true)
    setProgress({ done: 0, total: files.length })

    const failures: string[] = []
    let done = 0
    for (const file of files) {
      const err = await uploadFile(file)
      if (err) failures.push(`${file.name}: ${err}`)
      done += 1
      setProgress({ done, total: files.length })
    }

    setErrors(failures)
    setUploading(false)
    setProgress(null)
    // reset input so the same file can be re-selected after an error
    if (fileRef.current) fileRef.current.value = ''
    router.refresh()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    void uploadFiles(e.target.files ? Array.from(e.target.files) : [])
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!canEdit || uploading) return
    e.preventDefault()
    dragDepth.current += 1
    setDragActive(true)
  }

  function handleDragOver(e: React.DragEvent) {
    if (!canEdit || uploading) return
    e.preventDefault()
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!canEdit || uploading) return
    e.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (!canEdit || uploading) return
    e.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    void uploadFiles(e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [])
  }

  function openDriveDialog() {
    setDriveUrl('')
    setDriveError(null)
    setDriveDialogOpen(true)
  }

  /** Links an existing Drive file as a reference attachment (no copy is made). */
  async function submitDriveLink(e: React.FormEvent) {
    e.preventDefault()
    if (driveLinking) return

    setDriveLinking(true)
    setDriveError(null)
    try {
      const res = await fetch('/api/attachments/drive-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ drive_url: driveUrl, entityType, entityId }),
      })
      const json = (await res.json()) as { id?: string; error?: string }

      if (!res.ok || !json.id) {
        setDriveError(json.error ?? 'Error al vincular el documento')
        return
      }

      setDriveDialogOpen(false)
      setDriveUrl('')
      router.refresh()
    } catch {
      setDriveError('Error de red')
    } finally {
      setDriveLinking(false)
    }
  }

  return (
    <Card
      className={cn('relative', dragActive && 'ring-2 ring-primary ring-offset-2')}
      onDragEnter={canEdit ? handleDragEnter : undefined}
      onDragOver={canEdit ? handleDragOver : undefined}
      onDragLeave={canEdit ? handleDragLeave : undefined}
      onDrop={canEdit ? handleDrop : undefined}
    >
      {canEdit && dragActive && (
        <div className="border-primary bg-background/85 pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed backdrop-blur-sm">
          <UploadCloud className="text-primary size-6" />
          <p className="text-sm font-medium">Suelta los archivos para adjuntarlos</p>
        </div>
      )}
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="min-w-0 truncate">{title}</CardTitle>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <IconButton
                type="button"
                variant="outline"
                label="Hacer foto"
                className="sm:h-7 sm:w-auto sm:px-2.5"
                disabled={uploading}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="size-3.5" />
                <span className="sr-only sm:not-sr-only">Hacer foto</span>
              </IconButton>
              <IconButton
                type="button"
                variant="outline"
                label={uploading ? 'Subiendo archivos' : 'Añadir archivos'}
                className="sm:h-7 sm:w-auto sm:px-2.5"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="sr-only sm:not-sr-only">
                      {progress ? `Subiendo ${progress.done}/${progress.total}…` : 'Subiendo…'}
                    </span>
                  </>
                ) : (
                  <>
                    <Paperclip className="size-3.5" />
                    <span className="sr-only sm:not-sr-only">Añadir archivos</span>
                  </>
                )}
              </IconButton>
              <IconButton
                type="button"
                variant="outline"
                label="Vincular desde Google Drive"
                className="sm:h-7 sm:w-auto sm:px-2.5"
                onClick={openDriveDialog}
              >
                <GoogleDriveIcon />
                <span className="sr-only sm:not-sr-only">Vincular desde Google Drive</span>
              </IconButton>
            </div>
          </>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {errors.length > 0 && (
          <ul className="space-y-0.5 px-6 pb-2">
            {errors.map((msg) => (
              <li key={msg} className="text-destructive text-sm font-medium">
                {msg}
              </li>
            ))}
          </ul>
        )}
        {attachments.length === 0 ? (
          <p className="text-muted-foreground px-6 py-2 text-sm">
            {canEdit
              ? 'Sin adjuntos. Arrastra archivos aquí o usa «Añadir archivos».'
              : 'Sin adjuntos.'}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-6 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  {a.size_bytes ? (
                    <p className="text-muted-foreground text-xs">{formatSize(a.size_bytes)}</p>
                  ) : null}
                </div>
                {a.source === 'drive' && a.web_view_link ? (
                  <Button asChild variant="ghost" size="icon" className="size-7 shrink-0">
                    <Link
                      href={a.web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en Drive"
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="sr-only">Abrir en Drive</span>
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" size="icon" className="size-7 shrink-0">
                    <Link
                      href={`/api/documents/${a.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Descargar"
                    >
                      <Download className="size-3.5" />
                      <span className="sr-only">Descargar</span>
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={driveDialogOpen} onOpenChange={setDriveDialogOpen}>
        <DialogContent>
          <form onSubmit={submitDriveLink}>
            <DialogHeader>
              <DialogTitle>Vincular documento de Drive</DialogTitle>
              <DialogDescription>
                Pega el enlace de un Google Doc, Sheet o carpeta. Se guardará solo una referencia:
                el original sigue editándose en Drive.
              </DialogDescription>
            </DialogHeader>
            <FormRow label="Enlace de Drive" htmlFor="drive-url" error={driveError} required>
              <Input
                id="drive-url"
                type="url"
                placeholder="https://docs.google.com/document/d/…"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                disabled={driveLinking}
                required
              />
            </FormRow>
            <DialogFooter>
              <Button type="submit" disabled={driveLinking || !driveUrl}>
                {driveLinking ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Vinculando…
                  </>
                ) : (
                  'Vincular'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
