'use client'

import { ImageUp as ImagePlus, LoaderCircle as Loader2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

import type { MediaItem } from '@/lib/social/core'
import { cn } from '@/lib/utils'

import { MediaThumb } from '../../_components/media-thumb'

/**
 * Controlled media picker. Uploads File bytes to /api/social/upload (which
 * returns public MediaItem[]), then hands the resulting items up to the form.
 * Raw bytes never touch the JSON server action — only the public URLs do.
 *
 * Supports both click-to-browse and drag-and-drop onto the whole zone.
 */
export function MediaPicker({
  value,
  onChange,
  disabled,
  max = 10,
}: {
  value: MediaItem[]
  onChange: (items: MediaItem[]) => void
  disabled?: boolean
  max?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)

  const isFull = value.length >= max
  const isDisabled = disabled || uploading || isFull

  /** Convert PNG/WebP to JPEG so Instagram accepts them. JPEG stays as-is. */
  async function normalizeImage(file: File): Promise<File> {
    if (file.type === 'image/jpeg') return file
    if (!file.type.startsWith('image/')) return file // videos pass through
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas context error'))
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas toBlob failed'))
            const name = file.name.replace(/\.[^.]+$/, '.jpg')
            resolve(new File([blob], name, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.92,
        )
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Image load error'))
      }
      img.src = url
    })
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    setError(null)
    const room = max - value.length
    if (room <= 0) {
      setError(`Máximo ${max} archivos`)
      return
    }
    const raw = Array.from(files).slice(0, room)
    const normalized = await Promise.all(raw.map((f) => normalizeImage(f)))
    const body = new FormData()
    for (const f of normalized) body.append('files', f)

    setUploading(true)
    try {
      const res = await fetch('/api/social/upload', { method: 'POST', body })
      const json = (await res.json()) as { media?: MediaItem[]; error?: string }
      if (!res.ok || !json.media) {
        setError(json.error ?? 'Error subiendo archivos')
        return
      }
      onChange([...value, ...json.media])
    } catch {
      setError('Error de red al subir')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current += 1
    if (!isDisabled) setDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current === 0) setDragging(false)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    if (isDisabled) return
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Drop zone wrapper */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone; file selection is also available via the accessible input/button below */}
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          'relative rounded-xl border-2 border-dashed p-3 transition-colors duration-150',
          dragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-border',
          isDisabled && !dragging && 'opacity-60',
        )}
      >
        {/* Drag overlay */}
        {dragging && (
          <div className="bg-primary/10 pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl">
            <Upload className="text-primary size-8" />
            <span className="text-primary text-sm font-medium">
              Suelta {value.length < max - 1 ? 'los archivos' : 'el archivo'} aquí
            </span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {value.map((item) => (
            <div key={item.storagePath} className="group/thumb relative">
              <MediaThumb item={item} />
              <button
                type="button"
                onClick={() => onChange(value.filter((m) => m.storagePath !== item.storagePath))}
                className="bg-destructive ring-card absolute -top-1.5 -right-1.5 grid size-5 place-content-center rounded-full text-white opacity-0 shadow ring-2 transition-opacity group-hover/thumb:opacity-100"
                aria-label="Quitar archivo"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {/* Add button cell */}
          {!isFull && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50',
              )}
              aria-label="Añadir archivos"
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="size-5" />
                  <span className="text-[10px] font-medium">Añadir</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Hint shown when no files yet */}
        {value.length === 0 && !dragging && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="text-muted-foreground mt-3 flex w-full flex-col items-center gap-1 py-4 disabled:pointer-events-none"
          >
            <Upload className="size-7" />
            <span className="text-sm font-medium">
              Arrastra archivos o haz clic para seleccionar
            </span>
            <span className="text-xs">Imágenes o vídeo · máximo {max} archivos</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-muted-foreground text-xs">
          {value.length}/{max} archivos · imágenes o vídeo
        </p>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
