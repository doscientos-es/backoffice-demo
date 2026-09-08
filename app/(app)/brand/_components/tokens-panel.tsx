'use client'

import { Pencil, Plus, Trash as Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { deleteToken } from '../actions'
import { type BrandToken, TokenEditDialog } from './token-edit-dialog'

const GROUP_LABELS: Record<BrandToken['token_group'], string> = {
  color: 'Colores',
  typography: 'Tipografía',
  spacing: 'Espaciado',
  radius: 'Radios',
  shadow: 'Sombras',
}

function isColor(value: string) {
  return /^(#|oklch|rgb|hsl|color-)/.test(value.trim())
}

function ColorSwatch({ value }: { value: string }) {
  return (
    <span
      className="border-border inline-block size-4 shrink-0 rounded-sm border"
      style={{ background: value }}
      title={value}
    />
  )
}

function TokenRow({
  token,
  isAdmin,
  onEdit,
}: {
  token: BrandToken
  isAdmin: boolean
  onEdit: (t: BrandToken) => void
}) {
  const [pending, startTransition] = useTransition()
  const showSwatch = token.token_group === 'color' && isColor(token.value)

  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showSwatch && <ColorSwatch value={token.value} />}
        <code className="text-foreground shrink-0 font-mono text-xs">--{token.key}</code>
        <span className="text-muted-foreground truncate text-xs">{token.value}</span>
        {token.value_dark && (
          <Badge variant="neutral" className="shrink-0 text-[10px]">
            dark: {token.value_dark}
          </Badge>
        )}
      </div>
      {token.description && (
        <span className="text-muted-foreground hidden max-w-xs truncate text-xs md:block">
          {token.description}
        </span>
      )}
      {isAdmin && (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(token)} title="Editar">
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            disabled={pending}
            title="Eliminar"
            onClick={() => {
              if (!confirm(`¿Eliminar el token --${token.key}?`)) return
              startTransition(async () => {
                await deleteToken({ id: token.id })
              })
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function TokensPanel({ tokens, isAdmin }: { tokens: BrandToken[]; isAdmin: boolean }) {
  const [editTarget, setEditTarget] = useState<BrandToken | null | undefined>(undefined)
  const grouped = tokens.reduce<Partial<Record<BrandToken['token_group'], BrandToken[]>>>(
    (acc, t) => {
      if (!acc[t.token_group]) acc[t.token_group] = []
      acc[t.token_group]!.push(t)
      return acc
    },
    {},
  )
  const orderedGroups = (
    ['color', 'typography', 'spacing', 'radius', 'shadow'] as BrandToken['token_group'][]
  ).filter((g) => grouped[g]?.length)

  return (
    <>
      <div className="flex flex-col gap-6">
        {isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditTarget(null)}>
              <Plus className="size-3.5" />
              Nuevo token
            </Button>
          </div>
        )}

        {orderedGroups.map((group) => (
          <section key={group} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              {GROUP_LABELS[group]}
            </h3>
            <div className="flex flex-col gap-1.5">
              {(grouped[group] ?? []).map((t) => (
                <TokenRow key={t.id} token={t} isAdmin={isAdmin} onEdit={setEditTarget} />
              ))}
            </div>
          </section>
        ))}

        {tokens.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No hay tokens. Añade el primero.
          </p>
        )}
      </div>

      {editTarget !== undefined && (
        <TokenEditDialog
          open
          token={editTarget}
          onOpenChange={(v) => {
            if (!v) setEditTarget(undefined)
          }}
        />
      )}
    </>
  )
}
