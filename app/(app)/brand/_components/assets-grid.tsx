'use client'

import { Check, Copy, Download, Image, Trash as Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { deleteAsset } from '../actions'

const CATEGORY_LABELS: Record<string, string> = {
  logo: 'Logo',
  isotipo: 'Isotipo',
  background: 'Background',
  banner: 'Banner',
  other: 'Otro',
}
const ALL_CATEGORIES = ['logo', 'isotipo', 'background', 'banner', 'other'] as const

export type BrandAsset = {
  id: string
  name: string
  description: string | null
  category: string
  mime_type: string | null
  size_bytes: number | null
  public_url: string
  created_at: string
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" size="icon-sm" onClick={copy} title="Copiar URL pública">
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

function DeleteButton({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition()
  if (!isAdmin) return null
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => {
        if (!confirm('¿Eliminar este asset?')) return
        startTransition(async () => {
          await deleteAsset(id)
        })
      }}
      disabled={pending}
      title="Eliminar"
      className="text-destructive hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}

function AssetCard({ asset, isAdmin }: { asset: BrandAsset; isAdmin: boolean }) {
  const isImage = asset.mime_type?.startsWith('image/')
  const isSvg = asset.mime_type === 'image/svg+xml'
  return (
    <div className="group border-border bg-card flex flex-col overflow-hidden rounded-lg border">
      <div className="bg-secondary/40 relative flex h-36 items-center justify-center">
        {isImage ? (
          // biome-ignore lint/performance/noImgElement: URL externa de Supabase Storage, no compatible con next/image
          <img
            src={asset.public_url}
            alt={asset.name}
            className={cn('max-h-full max-w-full object-contain p-4', isSvg && 'w-full h-full')}
          />
        ) : (
          <Image className="text-muted-foreground/40 size-10" />
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm leading-tight font-medium">{asset.name}</p>
          <Badge variant="neutral" className="shrink-0 text-[10px]">
            {CATEGORY_LABELS[asset.category] ?? asset.category}
          </Badge>
        </div>
        {asset.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs">{asset.description}</p>
        )}
        <div className="flex items-center gap-1.5 pt-1">
          <CopyButton url={asset.public_url} />
          <Button variant="outline" size="icon-sm" asChild title="Descargar">
            <a href={asset.public_url} download={asset.name} target="_blank" rel="noreferrer">
              <Download className="size-3.5" />
            </a>
          </Button>
          <div className="ml-auto">
            <DeleteButton id={asset.id} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AssetsGrid({ assets, isAdmin }: { assets: BrandAsset[]; isAdmin: boolean }) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const usedCategories = ALL_CATEGORIES.filter((c) => assets.some((a) => a.category === c))
  const visible =
    activeCategory === 'all' ? assets : assets.filter((a) => a.category === activeCategory)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...usedCategories] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          No hay assets en esta categoría.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((a) => (
            <AssetCard key={a.id} asset={a} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}
