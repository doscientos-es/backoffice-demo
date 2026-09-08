'use client'
import {
  Check,
  CheckSquare,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Folder as FolderKanban,
  Inbox,
  Key as KeyRound,
  LoaderCircle as Loader2,
  Lock,
  Plus,
  Receipt,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { sileo } from 'sileo'

import { UnlockForm } from '@/app/(app)/vault/_components/vault-dialogs'
import { revealVaultSecret } from '@/app/(app)/vault/actions'
import type { SearchResultItem } from '@/app/api/search/route'
import { OPEN_COMMAND_PALETTE_EVENT } from '@/components/layout/command-palette-trigger'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NAVIGATION_GROUPS } from '@/lib/navigation/navigation'
import {
  CREATE_SHORTCUTS,
  mergeRecentItems,
  NAV_SHORTCUTS,
  RECENTS_STORAGE_KEY,
  type RecentItem,
} from '@/lib/navigation/shortcuts'

const TYPE_ICON = {
  lead: Inbox,
  client: Users,
  project: FolderKanban,
  invoice: Receipt,
  task: CheckSquare,
  vault: KeyRound,
} as const

const TYPE_LABEL: Record<SearchResultItem['type'], string> = {
  lead: 'Leads',
  client: 'Clientes',
  project: 'Proyectos',
  invoice: 'Facturas',
  task: 'Tareas',
  vault: 'Bóveda',
}

const NAVIGATION_KEYS = new Map(NAV_SHORTCUTS.map(({ href, key }) => [href, key]))
const ALL_NAV = NAVIGATION_GROUPS.flatMap((group) => group.items).map((item) => ({
  ...item,
  key: NAVIGATION_KEYS.get(item.href),
}))

function loadRecents(): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RecentItem[]) : []
  } catch {
    return []
  }
}

/**
 * Fila de resultado de la bóveda dentro del Command Palette. Muestra el nombre
 * del secreto y, en línea, botones para ver/ocultar y copiar. El secreto nunca
 * viaja en la búsqueda: se descifra bajo demanda vía `revealVaultSecret`.
 */
function VaultResultItem({
  item,
  Icon,
  secret,
  busy,
  copied,
  onCopy,
  onToggle,
}: {
  item: SearchResultItem
  Icon: React.ComponentType<{ className?: string }>
  secret: string | undefined
  busy: boolean
  copied: boolean
  onCopy: () => void
  onToggle: () => void
}) {
  return (
    <CommandItem value={`${item.label} ${item.sublabel ?? ''} vault`} onSelect={onCopy}>
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{item.label}</span>
        {secret ? (
          <span className="text-foreground truncate font-mono text-xs">{secret}</span>
        ) : item.sublabel ? (
          <span className="text-muted-foreground truncate text-xs">{item.sublabel}</span>
        ) : null}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {item.isSensitive ? <Lock className="size-3 text-amber-500" /> : null}
        <button
          type="button"
          aria-label={secret ? 'Ocultar secreto' : 'Ver secreto'}
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : secret ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          aria-label="Copiar secreto"
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1"
          onClick={(e) => {
            e.stopPropagation()
            onCopy()
          }}
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </CommandItem>
  )
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [recents, setRecents] = useState<RecentItem[]>([])

  // ── Vault (secretos) ──────────────────────────────────────────────────────
  // Secretos revelados en memoria mientras el palette está abierto (clave = uuid).
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [vaultBusyId, setVaultBusyId] = useState<string | null>(null)
  const [vaultCopiedId, setVaultCopiedId] = useState<string | null>(null)
  // Diálogo de desbloqueo pendiente: qué secreto y qué acción reintentar tras unlock.
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [pendingUnlock, setPendingUnlock] = useState<{
    id: string
    name: string
    mode: 'copy' | 'reveal'
  } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      // No conservar secretos revelados ni estados de la bóveda al cerrar.
      setRevealed({})
      setVaultBusyId(null)
      setVaultCopiedId(null)
      setUnlockOpen(false)
      setPendingUnlock(null)
      return
    }
    setRecents(loadRecents())
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error('search failed')
        const data = (await res.json()) as { items: SearchResultItem[] }
        setResults(data.items ?? [])
      } catch {
        if (!ctrl.signal.aborted) setResults([])
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 150)
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [query])

  const groups = useMemo(() => {
    const map = new Map<SearchResultItem['type'], SearchResultItem[]>()
    for (const r of results) {
      const arr = map.get(r.type) ?? []
      arr.push(r)
      map.set(r.type, arr)
    }
    return map
  }, [results])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  const selectResult = useCallback(
    (item: RecentItem) => {
      const next = mergeRecentItems(loadRecents(), item)
      try {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // localStorage no disponible: continúa sin persistir.
      }
      go(item.href)
    },
    [go],
  )

  // ── Handlers de la bóveda ──────────────────────────────────────────────────
  const copyToClipboard = useCallback(async (key: string, secret: string) => {
    try {
      await navigator.clipboard.writeText(secret)
      setVaultCopiedId(key)
      setTimeout(() => setVaultCopiedId((c) => (c === key ? null : c)), 1500)
      sileo.success({ title: 'Secreto copiado' })
    } catch {
      sileo.error({ title: 'No se pudo copiar' })
    }
  }, [])

  // Descifra bajo demanda. Si la bóveda está bloqueada, abre el diálogo de
  // desbloqueo y guarda la acción pendiente para reintentarla tras el unlock.
  const runVaultAction = useCallback(
    async (item: SearchResultItem, mode: 'copy' | 'reveal') => {
      const rawId = item.id.replace(/^vault-/, '')
      setVaultBusyId(item.id)
      try {
        const r = await revealVaultSecret({ id: rawId })
        if (r.ok && 'secret' in r) {
          const secret = r.secret as string
          if (mode === 'copy') await copyToClipboard(item.id, secret)
          else setRevealed((rv) => ({ ...rv, [item.id]: secret }))
          return
        }
        const error = 'error' in r ? String(r.error) : ''
        if (error.toLowerCase().includes('desbloquea')) {
          setPendingUnlock({ id: item.id, name: item.label, mode })
          setUnlockOpen(true)
        } else {
          sileo.error({ title: error || 'No se pudo revelar el secreto' })
        }
      } finally {
        setVaultBusyId(null)
      }
    },
    [copyToClipboard],
  )

  const handleVaultCopy = useCallback(
    (item: SearchResultItem) => {
      const existing = revealed[item.id]
      if (existing) {
        void copyToClipboard(item.id, existing)
        return
      }
      void runVaultAction(item, 'copy')
    },
    [revealed, copyToClipboard, runVaultAction],
  )

  const handleVaultToggle = useCallback(
    (item: SearchResultItem) => {
      if (revealed[item.id]) {
        setRevealed((rv) => {
          const n = { ...rv }
          delete n[item.id]
          return n
        })
        return
      }
      void runVaultAction(item, 'reveal')
    },
    [revealed, runVaultAction],
  )

  const handleUnlockSuccess = useCallback(() => {
    setUnlockOpen(false)
    const pending = pendingUnlock
    setPendingUnlock(null)
    if (!pending) return
    const item = results.find((r) => r.id === pending.id)
    if (item) void runVaultAction(item, pending.mode)
  }, [pendingUnlock, results, runVaultAction])

  const hasResults = results.length > 0
  const isSearching = query.trim().length > 0

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          // No cerrar el palette mientras el diálogo de desbloqueo está abierto:
          // un click dentro del diálogo (portal) cuenta como "click fuera".
          if (!o && unlockOpen) return
          setOpen(o)
        }}
      >
        <CommandInput
          placeholder="Buscar clientes, proyectos, leads…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {/* Estado vacío / buscando */}
          <CommandEmpty>
            {loading ? (
              <span className="text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Buscando…
              </span>
            ) : isSearching ? (
              <span className="flex flex-col items-center gap-0.5">
                <span className="font-medium">Sin resultados</span>
                <span className="text-muted-foreground text-xs">
                  No hay nada que coincida con "{query}"
                </span>
              </span>
            ) : null}
          </CommandEmpty>

          {/* Indicador de carga mientras hay resultados previos */}
          {loading && hasResults && (
            <div className="text-muted-foreground/60 flex items-center gap-1.5 px-3 py-1 text-[10px]">
              <Loader2 className="size-2.5 animate-spin" />
              Actualizando…
            </div>
          )}

          {/* Resultados de búsqueda agrupados por tipo */}
          {Array.from(groups.entries()).map(([type, items]) => {
            const Icon = TYPE_ICON[type]
            return (
              <CommandGroup key={type} heading={TYPE_LABEL[type]}>
                {items.map((r) =>
                  type === 'vault' ? (
                    <VaultResultItem
                      key={r.id}
                      item={r}
                      Icon={Icon}
                      secret={revealed[r.id]}
                      busy={vaultBusyId === r.id}
                      copied={vaultCopiedId === r.id}
                      onCopy={() => handleVaultCopy(r)}
                      onToggle={() => handleVaultToggle(r)}
                    />
                  ) : (
                    <CommandItem
                      key={r.id}
                      value={`${r.label} ${r.sublabel ?? ''} ${type}`}
                      onSelect={() => selectResult({ href: r.href, label: r.label, type })}
                    >
                      <Icon className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate">{r.label}</span>
                      {r.sublabel ? (
                        <span className="text-muted-foreground ml-auto max-w-[40%] shrink-0 truncate text-xs">
                          {r.sublabel}
                        </span>
                      ) : null}
                    </CommandItem>
                  ),
                )}
              </CommandGroup>
            )
          })}

          {/* Estado vacío: recientes + navegación + acciones */}
          {!isSearching ? (
            <>
              {recents.length > 0 ? (
                <>
                  <CommandGroup heading="Recientes">
                    {recents.map((r) => {
                      const Icon = r.type
                        ? (TYPE_ICON[r.type as SearchResultItem['type']] ?? Clock)
                        : Clock
                      return (
                        <CommandItem
                          key={r.href}
                          value={`reciente ${r.label}`}
                          onSelect={() => selectResult(r)}
                        >
                          <Icon className="text-muted-foreground size-4 shrink-0" />
                          <span className="truncate">{r.label}</span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              ) : null}

              <CommandGroup heading="Ir a…">
                {ALL_NAV.map((l) => {
                  const Icon = l.icon
                  return (
                    <CommandItem key={l.href} value={`ir a ${l.label}`} onSelect={() => go(l.href)}>
                      <Icon className="text-muted-foreground size-4 shrink-0" />
                      {l.label}
                      {l.key ? (
                        <CommandShortcut className="hidden sm:inline">
                          G {l.key.toUpperCase()}
                        </CommandShortcut>
                      ) : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Crear">
                {CREATE_SHORTCUTS.map((a) => (
                  <CommandItem key={a.href} value={`crear ${a.label}`} onSelect={() => go(a.href)}>
                    <Plus className="text-muted-foreground size-4 shrink-0" />
                    {a.label}
                    <CommandShortcut className="hidden sm:inline">
                      C {a.key.toUpperCase()}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>

      <Dialog
        open={unlockOpen}
        onOpenChange={(o) => {
          setUnlockOpen(o)
          if (!o) setPendingUnlock(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desbloquear bóveda</DialogTitle>
            <DialogDescription>
              Introduce la contraseña maestra para{' '}
              {pendingUnlock?.mode === 'copy' ? 'copiar' : 'ver'} «
              {pendingUnlock?.name ?? 'este secreto'}».
            </DialogDescription>
          </DialogHeader>
          <UnlockForm onClose={() => setUnlockOpen(false)} onSuccess={handleUnlockSuccess} />
        </DialogContent>
      </Dialog>
    </>
  )
}
