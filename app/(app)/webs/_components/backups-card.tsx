'use client'

import {
  ChevronLeft,
  Download,
  FolderOpen,
  HardDrive,
  RefreshCw,
  Trash as Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { usePasskeyVerification } from '@/components/security/use-passkey-verification'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { FileBrowserItem, FileBrowserListing } from '@/lib/filebrowser'
import { userVerificationScope } from '@/lib/security/user-verification-scope'

import { ForceBackupButton } from './force-backup-button'

// Session-scoped stale-while-revalidate cache. Keyed by `slug:subPath`, it lets
// a revisited folder render instantly while a fresh listing loads in the
// background, instead of flashing a skeleton on every mount/navigation. The
// server still owns freshness via its tagged Data Cache; this is UI-only.
const listingCache = new Map<string, FileBrowserListing>()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = bytes / 1024
  return `${kb.toFixed(0)} KB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Inner components ─────────────────────────────────────────────────────────

function FolderRow({ item, onClick }: { item: FileBrowserItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors"
    >
      <FolderOpen className="size-4 shrink-0 text-amber-500" />
      <span className="flex-1 truncate text-left font-medium">{item.name}</span>
      <ChevronLeft className="text-muted-foreground size-4 shrink-0 rotate-180" />
    </button>
  )
}

function FileRow({
  item,
  clientSlug,
  subPath,
  canDelete,
  onDeleted,
}: {
  item: FileBrowserItem
  clientSlug: string
  subPath: string
  canDelete: boolean
  onDeleted: () => void
}) {
  const filePath = subPath ? `${subPath}/${item.name}` : item.name
  const downloadUrl = `/api/backups/${clientSlug}/download?path=${encodeURIComponent(filePath)}`

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const { challenge, verifyWithPasskey } = usePasskeyVerification()

  function onConfirmDelete() {
    startTransition(async () => {
      try {
        const verification = await verifyWithPasskey(
          userVerificationScope('backup.delete', `backup:${clientSlug}:${filePath}`),
        )
        if (!verification.ok) {
          sileo.error({ title: verification.error })
          return
        }
        const url = `/api/backups/${clientSlug}?path=${encodeURIComponent(filePath)}`
        const res = await fetch(url, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        sileo.success({ title: 'Backup eliminado' })
        setConfirmOpen(false)
        onDeleted()
      } catch {
        sileo.error({ title: 'No se pudo eliminar el backup' })
      }
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm">
      <HardDrive className="text-muted-foreground size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-mono text-xs">{item.name}</span>
        <span className="text-muted-foreground text-xs">{formatDate(item.modified)}</span>
      </div>
      <Badge variant="neutral" className="shrink-0 font-mono text-[10px]">
        {formatBytes(item.size)}
      </Badge>
      <a href={downloadUrl} download className="ml-1 shrink-0">
        <Button variant="ghost" size="icon" className="size-7">
          <Download className="size-3.5" />
        </Button>
      </a>
      {canDelete && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive size-7 shrink-0"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Eliminar ${item.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Eliminar copia de seguridad"
            description={
              <>
                Se eliminará <strong>{item.name}</strong> de forma permanente. Esta acción no se
                puede deshacer.
              </>
            }
            confirmLabel="Eliminar"
            destructive
            pending={pending}
            onConfirm={onConfirmDelete}
          />
        </>
      )}
      {challenge}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BackupsCard({
  clientSlug,
  projectId,
  canForceBackup = false,
  canDelete = false,
}: {
  clientSlug: string
  projectId?: string
  canForceBackup?: boolean
  canDelete?: boolean
}) {
  const [subPath, setSubPath] = useState('')
  const [listing, setListing] = useState<FileBrowserListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchListing = useCallback(
    async (path: string, forceFresh = false) => {
      const cacheKey = `${clientSlug}:${path}`
      if (forceFresh) listingCache.delete(cacheKey)

      const cached = listingCache.get(cacheKey)
      if (cached) {
        // Show last-known data immediately; the fetch below revalidates it.
        setListing(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }
      setError(false)

      try {
        const url = `/api/backups/${clientSlug}${path ? `?path=${encodeURIComponent(path)}` : ''}`
        const res = await fetch(url, forceFresh ? { cache: 'no-store' } : undefined)
        if (!res.ok) throw new Error()
        const data = (await res.json()) as FileBrowserListing
        listingCache.set(cacheKey, data)
        setListing(data)
      } catch {
        // Keep showing cached data on a background-refresh failure; only surface
        // the error state when there is nothing cached to display.
        if (!cached) {
          setError(true)
          setListing(null)
        }
      } finally {
        setLoading(false)
      }
    },
    [clientSlug],
  )

  useEffect(() => {
    fetchListing(subPath)
  }, [fetchListing, subPath])

  const byModifiedDesc = (a: FileBrowserItem, b: FileBrowserItem) =>
    new Date(b.modified).getTime() - new Date(a.modified).getTime()

  const dirs = (listing?.items.filter((i) => i.isDir) ?? []).sort(byModifiedDesc)
  const files = (listing?.items.filter((i) => !i.isDir) ?? []).sort(byModifiedDesc)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Copias de seguridad</CardTitle>
          <div className="flex items-center gap-1">
            {subPath && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setSubPath('')}
              >
                <ChevronLeft className="size-3" />
                Volver
              </Button>
            )}
            {canForceBackup && projectId && (
              <ForceBackupButton projectId={projectId} slug={clientSlug} />
            )}
          </div>
        </div>
        {subPath && <p className="text-muted-foreground font-mono text-[11px]">{subPath}</p>}
      </CardHeader>
      <CardContent className="px-0 pb-1">
        {loading && (
          <div className="flex flex-col gap-1 px-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-9 w-full rounded-md" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-start gap-2 px-6 py-3">
            <p className="text-muted-foreground text-sm">
              No se pudieron cargar los backups. Verifique la conexión con FileBrowser.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => fetchListing(subPath, true)}
            >
              <RefreshCw className="size-3" />
              Reintentar
            </Button>
          </div>
        )}
        {!loading && !error && listing && dirs.length + files.length === 0 && (
          <p className="text-muted-foreground px-6 py-3 text-sm">Sin archivos.</p>
        )}
        {!loading && !error && listing && (
          <div className="divide-border/50 flex flex-col divide-y">
            {dirs.map((item) => (
              <FolderRow
                key={item.name}
                item={item}
                onClick={() => setSubPath(subPath ? `${subPath}/${item.name}` : item.name)}
              />
            ))}
            {files.map((item) => (
              <FileRow
                key={item.name}
                item={item}
                clientSlug={clientSlug}
                subPath={subPath}
                canDelete={canDelete}
                onDeleted={() => fetchListing(subPath, true)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
