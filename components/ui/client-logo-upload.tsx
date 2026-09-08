'use client'

import { Globe, ImageUp as ImagePlus, LoaderCircle as Loader2, Search, X } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { getBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'

const BUCKET = 'client-logos'
const MAX_PX = 480
const QUALITY = 0.82

async function resizeAndCompress(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas context error'))
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/webp',
        QUALITY,
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function ClientLogoUpload({
  defaultLogoUrl,
  clientId,
}: {
  defaultLogoUrl?: string | null
  /** When editing an existing client, pass the id to use as stable filename. */
  clientId?: string
}) {
  const [preview, setPreview] = useState<string | null>(defaultLogoUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string>(defaultLogoUrl ?? '')
  const [dragging, setDragging] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [domainValue, setDomainValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  // Notify the parent form of changes so useFormDirty detects the logo update.
  // React-controlled hidden inputs don't fire native DOM events when their value
  // changes, so we dispatch one manually after every logoUrl state transition.
  useEffect(() => {
    // logoUrl is used here as the trigger; we also reference it to satisfy the
    // exhaustive-deps rule even though the dispatched event is what we need.
    if (logoUrl !== undefined) {
      hiddenInputRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, [logoUrl])

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const blob = await resizeAndCompress(file)
      const path = clientId
        ? `${clientId}.webp`
        : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      const supabase = getBrowserClient()
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/webp', upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      // Cache-bust so the browser shows the new image even if path is same
      const url = `${data.publicUrl}?t=${Date.now()}`
      setPreview(url)
      setLogoUrl(data.publicUrl) // store clean URL (no cache-bust) in DB
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setPreview(null)
    setLogoUrl('')
    setUrlValue('')
    setDomainValue('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }

  function handleUrlApply() {
    const url = urlValue.trim()
    if (!url) return
    setPreview(url)
    setLogoUrl(url)
    setError(null)
  }

  async function handleDomainSearch() {
    const raw = domainValue
      .trim()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
    if (!raw) return
    const clearbitUrl = `https://logo.clearbit.com/${raw}`
    setUploading(true)
    setError(null)
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('No se encontró logo'))
        img.src = clearbitUrl
      })
      setPreview(clearbitUrl)
      setLogoUrl(clearbitUrl)
      setDomainValue('')
    } catch {
      setError(`No se encontró logo para "${raw}". Prueba con el dominio exacto, ej: apple.com`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Hidden form field carrying the stored URL */}
      <input ref={hiddenInputRef} type="hidden" name="logo_url" value={logoUrl} />

      <div className="flex items-start gap-4">
        {/* Drop zone / preview */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={uploading}
          className={cn(
            'relative flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dragging ? 'border-primary bg-primary/5 scale-105' : 'bg-muted/40',
            uploading && 'cursor-wait opacity-60',
          )}
          aria-label="Subir logo"
        >
          {uploading ? (
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          ) : preview ? (
            <Image
              src={preview}
              alt="Logo"
              fill
              className="rounded-xl object-contain p-1"
              unoptimized
            />
          ) : (
            <ImagePlus className="text-muted-foreground size-5" />
          )}
        </button>

        <div className="flex flex-col gap-1.5 pt-1">
          <p className="text-foreground text-sm font-medium">
            Logo del cliente <span className="text-muted-foreground font-normal">(opcional)</span>
          </p>
          <p className="text-muted-foreground text-xs">
            Haz clic, arrastra una imagen, pega una URL o busca por dominio.
          </p>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-destructive flex w-fit items-center gap-1 text-xs hover:underline"
            >
              <X className="size-3" /> Eliminar logo
            </button>
          )}
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      </div>

      {/* Secondary input options */}
      <div className="flex flex-col gap-2 pl-24">
        {/* Direct URL input */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Globe className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <input
              type="url"
              placeholder="https://empresa.com/logo.png"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleUrlApply()
                }
              }}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-7 w-full rounded-md border pr-2 pl-7 text-xs focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleUrlApply}
            disabled={!urlValue.trim()}
            className="border-input bg-background hover:bg-accent h-7 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            Usar URL
          </button>
        </div>

        {/* Domain search via Clearbit */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <input
              type="text"
              placeholder="empresa.com · busca el logo automáticamente"
              value={domainValue}
              onChange={(e) => setDomainValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleDomainSearch()
                }
              }}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-7 w-full rounded-md border pr-2 pl-7 text-xs focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleDomainSearch}
            disabled={!domainValue.trim() || uploading}
            className="border-input bg-background hover:bg-accent h-7 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
          >
            {uploading ? <Loader2 className="size-3 animate-spin" /> : 'Buscar'}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
