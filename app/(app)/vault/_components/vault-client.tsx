'use client'

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle as Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash as Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { VAULT_SERVICE_LABELS, VAULT_SERVICES, type VaultService } from '@/lib/schemas/vault'
import { cn } from '@/lib/utils'
import { filterAndSortVaultItems, type VaultListItem, type VaultSortField } from '@/lib/vault/list'

import { deleteVaultItem, lockVault, revealVaultSecret } from '../actions'
import { SetPasswordForm, UnlockForm } from './vault-dialogs'
import { VaultItemForm } from './vault-item-dialog'

type VaultItem = VaultListItem
type Client = { id: string; name: string }
type Dialog_ = 'add' | 'edit' | 'unlock' | 'setPassword' | null
type SortField = VaultSortField

const PAGE_SIZE = 20

const SERVICE_COLORS: Record<string, string> = {
  hosting: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  domain: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  cms: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  database: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  api: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  email: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  ssh: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  vpn: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  other: 'bg-muted text-muted-foreground',
}

export function VaultClient({
  items,
  passwordSet,
  unlocked,
  passkeyConfigured,
  clients,
  isAdmin,
}: {
  items: VaultItem[]
  passwordSet: boolean
  unlocked: boolean
  passkeyConfigured: boolean
  clients: Client[]
  isAdmin: boolean
}) {
  const [dialog, setDialog] = useState<Dialog_>(null)
  const [editItem, setEditItem] = useState<VaultItem | null>(null)
  const [pendingEditItem, setPendingEditItem] = useState<VaultItem | null>(null)
  const [pendingRevealItem, setPendingRevealItem] = useState<VaultItem | null>(null)
  const [localUnlocked, setLocalUnlocked] = useState(unlocked)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // ── filters / sort / pagination ────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [sensitiveFilter, setSensitiveFilter] = useState<'' | 'sensitive' | 'public'>('')
  const [clientFilter, setClientFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const hasActiveFilters = !!(search || serviceFilter || sensitiveFilter || clientFilter)

  function clearFilters() {
    setSearch('')
    setServiceFilter('')
    setSensitiveFilter('')
    setClientFilter('')
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  // Reset to page 1 whenever filters / sort change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filters/sort are intentional triggers; the effect only resets pagination
  useEffect(() => {
    setPage(1)
  }, [search, serviceFilter, sensitiveFilter, clientFilter, sortField, sortDir])

  const filtered = useMemo(
    () =>
      filterAndSortVaultItems(items, {
        search,
        service: serviceFilter,
        sensitivity: sensitiveFilter,
        clientId: clientFilter,
        sortField,
        sortDirection: sortDir,
      }),
    [items, search, serviceFilter, sensitiveFilter, clientFilter, sortField, sortDir],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Auto-reveal non-sensitive items on mount — no reason to hide them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items is used on mount to reveal non-sensitive secrets
  useEffect(() => {
    const nonSensitive = items.filter((i) => !i.is_sensitive)
    if (nonSensitive.length === 0) return
    startTransition(async () => {
      const results = await Promise.all(
        nonSensitive.map((item) => revealVaultSecret({ id: item.id })),
      )
      setRevealed((rv) => {
        const next = { ...rv }
        results.forEach((r, idx) => {
          if (r.ok && 'secret' in r) next[nonSensitive[idx]!.id] = r.secret as string
        })
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openEdit(item: VaultItem) {
    if (!isAdmin) return
    if (item.is_sensitive && !localUnlocked) {
      setPendingEditItem(item)
      setDialog('unlock')
      return
    }
    setEditItem(item)
    setDialog('edit')
  }

  function handleUnlockSuccess() {
    setLocalUnlocked(true)
    if (pendingEditItem) {
      setEditItem(pendingEditItem)
      setPendingEditItem(null)
      setDialog('edit')
      return
    }
    if (pendingRevealItem) {
      const item = pendingRevealItem
      setPendingRevealItem(null)
      setDialog(null)
      setRevealingId(item.id)
      startTransition(async () => {
        const r = await revealVaultSecret({ id: item.id })
        if (r.ok && 'secret' in r) {
          setRevealed((rv) => ({ ...rv, [item.id]: r.secret as string }))
        } else {
          sileo.error({ title: 'error' in r ? r.error : 'No se pudo revelar el secreto' })
        }
        setRevealingId(null)
      })
    }
  }

  function handleReveal(item: VaultItem) {
    if (revealed[item.id]) {
      setRevealed((r) => {
        const n = { ...r }
        delete n[item.id]
        return n
      })
      return
    }
    if (item.is_sensitive && !localUnlocked) {
      setPendingRevealItem(item)
      setDialog('unlock')
      return
    }
    setRevealingId(item.id)
    startTransition(async () => {
      const r = await revealVaultSecret({ id: item.id })
      if (r.ok && 'secret' in r) {
        setRevealed((rv) => ({ ...rv, [item.id]: r.secret as string }))
      } else {
        sileo.error({ title: 'error' in r ? r.error : 'No se pudo revelar el secreto' })
      }
      setRevealingId(null)
    })
  }

  async function handleCopy(item: VaultItem) {
    const secret = revealed[item.id]
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopiedId(item.id)
      sileo.success({ title: 'Copiado al portapapeles' })
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1500)
    } catch {
      sileo.error({ title: 'No se pudo copiar' })
    }
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta credencial? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      await deleteVaultItem({ id })
    })
  }

  async function handleLock() {
    await lockVault()
    window.location.reload()
  }

  const expiresLabel = (d: string | null) => {
    if (!d) return null
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
    if (diff < 0)
      return (
        <Badge variant="destructive" className="px-1 text-[10px]">
          Caducado
        </Badge>
      )
    if (diff <= 30)
      return (
        <Badge variant="warning" className="px-1 text-[10px]">
          {diff}d
        </Badge>
      )
    return (
      <Badge variant="neutral" className="px-1 text-[10px]">
        {d}
      </Badge>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bóveda"
        description="Credenciales y secretos de clientes, cifrados con AES-256-GCM."
        actions={
          <div className="flex items-center gap-2">
            {passwordSet ? (
              unlocked ? (
                <Button variant="outline" size="sm" onClick={handleLock}>
                  <LockOpen className="size-3.5" /> Bloquear
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setDialog('unlock')}>
                  <Lock className="size-3.5" /> Desbloquear
                </Button>
              )
            ) : (
              <Button variant="outline" size="sm" onClick={() => setDialog('setPassword')}>
                <ShieldAlert className="size-3.5" /> Activar contraseña
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" onClick={() => setDialog('add')}>
                <Plus className="size-3.5" /> Añadir
              </Button>
            )}
          </div>
        }
      />

      {passwordSet && !unlocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Lock className="size-4 shrink-0" />
          <span>
            Los secretos sensibles están ocultos.{' '}
            <button
              type="button"
              className="underline hover:no-underline"
              onClick={() => setDialog('unlock')}
            >
              Desbloquear bóveda
            </button>
          </span>
        </div>
      )}

      <Card>
        <CardContent className="px-0 pt-0">
          {/* ── Controls ── */}
          <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <div className="relative max-w-xs min-w-[180px] flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, usuario…"
                className="h-8 pl-8 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              aria-label="Filtrar por servicio"
              className="h-8 max-w-[160px] text-sm"
            >
              <option value="">Servicio: todos</option>
              {VAULT_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {VAULT_SERVICE_LABELS[s]}
                </option>
              ))}
            </Select>
            <Select
              value={sensitiveFilter}
              onChange={(e) => setSensitiveFilter(e.target.value as '' | 'sensitive' | 'public')}
              aria-label="Filtrar por tipo"
              className="h-8 max-w-[160px] text-sm"
            >
              <option value="">Tipo: todos</option>
              <option value="sensitive">Sensibles</option>
              <option value="public">No sensibles</option>
            </Select>
            {clients.length > 0 && (
              <Select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                aria-label="Filtrar por cliente"
                className="h-8 max-w-[180px] text-sm"
              >
                <option value="">Cliente: todos</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8"
                onClick={clearFilters}
              >
                <X className="size-3.5" /> Limpiar
              </Button>
            )}
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
            </span>
          </div>

          {/* ── Table ── */}
          {items.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Sin credenciales aún</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setDialog('add')}>
                  <Plus className="size-3.5" /> Añadir primera credencial
                </Button>
              </EmptyContent>
            </Empty>
          ) : paged.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Sin coincidencias</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border bg-muted/30 text-muted-foreground border-b text-xs">
                    <SortTh
                      field="name"
                      label="Nombre"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="service"
                      label="Servicio"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="px-5 py-3 text-left font-medium tracking-wide">Usuario</th>
                    <th className="px-5 py-3 text-left font-medium tracking-wide">Secreto</th>
                    <SortTh
                      field="expires_at"
                      label="Caduca"
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="w-20 px-5 py-3" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {paged.map((item) => {
                    const isRevealed = !!revealed[item.id]
                    const isRevealing = revealingId === item.id
                    const isCopied = copiedId === item.id
                    return (
                      <tr key={item.id} className="group hover:bg-muted/40 transition-colors">
                        <td className="text-foreground px-5 py-3 font-medium">
                          <span className="flex items-center gap-1.5">
                            {item.name}
                            {item.is_sensitive && (
                              <Lock className="text-muted-foreground/60 size-3 shrink-0" />
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              SERVICE_COLORS[item.service] ?? SERVICE_COLORS.other,
                            )}
                          >
                            {VAULT_SERVICE_LABELS[item.service as VaultService] ?? item.service}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-5 py-3 font-mono text-xs">
                          {item.username ?? <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'font-mono text-xs',
                                isRevealed
                                  ? 'select-all text-foreground'
                                  : 'tracking-widest text-muted-foreground',
                              )}
                            >
                              {isRevealed ? revealed[item.id] : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleReveal(item)}
                              disabled={isRevealing}
                              aria-busy={isRevealing}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={
                                isRevealing ? 'Revelando…' : isRevealed ? 'Ocultar' : 'Revelar'
                              }
                            >
                              {isRevealing ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : isRevealed ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )}
                            </button>
                            {isRevealed && (
                              <button
                                type="button"
                                onClick={() => handleCopy(item)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={isCopied ? 'Copiado' : 'Copiar'}
                              >
                                {isCopied ? (
                                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">{expiresLabel(item.expires_at)}</td>
                        <td className="px-5 py-3">
                          {isAdmin && (
                            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => openEdit(item)}
                                aria-label="Editar"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleDelete(item.id)}
                                aria-label="Eliminar"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="border-border flex items-center justify-between border-t px-5 py-3">
              <span className="text-muted-foreground text-xs">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de{' '}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="text-muted-foreground px-1 text-xs">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit */}
      <Dialog
        open={dialog === 'add' || dialog === 'edit'}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'edit' ? 'Editar credencial' : 'Nueva credencial'}
            </DialogTitle>
            <DialogDescription>
              Los secretos se cifran con AES-256-GCM antes de guardarse.
            </DialogDescription>
          </DialogHeader>
          <VaultItemForm
            item={editItem ?? undefined}
            clients={clients}
            onClose={() => setDialog(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Unlock */}
      <Dialog open={dialog === 'unlock'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desbloquear bóveda</DialogTitle>
            <DialogDescription>
              Introduce la contraseña maestra para acceder a los secretos sensibles. La sesión dura
              4 horas.
            </DialogDescription>
          </DialogHeader>
          <UnlockForm
            passkeyConfigured={passkeyConfigured}
            onClose={() => setDialog(null)}
            onSuccess={handleUnlockSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Set password */}
      <Dialog open={dialog === 'setPassword'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {passwordSet ? 'Cambiar contraseña maestra' : 'Activar protección maestra'}
            </DialogTitle>
            <DialogDescription>
              {passwordSet
                ? 'Verifica la contraseña actual antes de cambiarla.'
                : 'Define una contraseña para proteger los secretos sensibles. No se puede recuperar si la pierdes.'}
            </DialogDescription>
          </DialogHeader>
          <SetPasswordForm hasPassword={passwordSet} onClose={() => setDialog(null)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── SortTh ────────────────────────────────────────────────────────────────────
function SortTh({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField
  label: string
  sortField: SortField
  sortDir: 'asc' | 'desc'
  onSort: (f: SortField) => void
}) {
  const active = sortField === field
  return (
    <th className="px-5 py-3 text-left font-medium tracking-wide">
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  )
}
