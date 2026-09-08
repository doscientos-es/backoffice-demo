'use client'

import { GitBranch as Github, Link as Link2, RefreshCw } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface OrgRepo {
  id: number
  name: string
  html_url: string
}

type RepoLoadState = 'idle' | 'loading' | 'ok' | 'error'

export type GitHubSyncMode = 'none' | 'link_only' | 'bidirectional'

export interface GitHubSyncSectionProps {
  idPrefix: string
  defaultMode?: GitHubSyncMode
  defaultRepoUrl?: string | null
  defaultInstallationId?: number | null
  defaultAutoSync?: boolean
}

const OPTIONS: Array<{
  value: GitHubSyncMode
  title: string
  description: string
  icon: ReactNode
}> = [
  {
    value: 'none',
    title: 'Sin GitHub',
    description: 'El proyecto vive sólo en el backoffice.',
    icon: <Github className="size-4" />,
  },
  {
    value: 'link_only',
    title: 'Solo enlace',
    description: 'Repo externo: enlazamos pero nunca escribimos en GitHub.',
    icon: <Link2 className="size-4" />,
  },
  {
    value: 'bidirectional',
    title: 'Sincronización completa',
    description: 'Las tareas crean y reciben issues automáticamente.',
    icon: <RefreshCw className="size-4" />,
  },
]

export function GitHubSyncSection({
  idPrefix,
  defaultMode = 'none',
  defaultRepoUrl,
  defaultInstallationId,
  defaultAutoSync = true,
}: GitHubSyncSectionProps) {
  const [mode, setMode] = useState<GitHubSyncMode>(defaultMode)
  const groupId = useId()
  const showRepo = mode !== 'none'
  const showSync = mode === 'bidirectional'

  // Org repos selector state
  const [orgRepos, setOrgRepos] = useState<OrgRepo[]>([])
  const [repoLoadState, setRepoLoadState] = useState<RepoLoadState>('idle')
  const [selectedRepoUrl, setSelectedRepoUrl] = useState(defaultRepoUrl ?? '')
  const [isManualEntry, setIsManualEntry] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!showRepo || fetchedRef.current) return
    fetchedRef.current = true
    setRepoLoadState('loading')
    fetch('/api/github/repos')
      .then((r) => r.json() as Promise<{ repos: OrgRepo[] }>)
      .then(({ repos }) => {
        setOrgRepos(repos)
        setRepoLoadState('ok')
        if (repos.length === 0) {
          setIsManualEntry(true)
          return
        }
        if (defaultRepoUrl) {
          if (repos.some((r) => r.html_url === defaultRepoUrl)) {
            setSelectedRepoUrl(defaultRepoUrl)
          } else {
            setIsManualEntry(true) // existing URL is outside the org
          }
        }
      })
      .catch(() => {
        setRepoLoadState('error')
        setIsManualEntry(true)
      })
  }, [showRepo, defaultRepoUrl])

  return (
    <fieldset className="border-border bg-muted/20 flex flex-col gap-3 rounded-lg border p-4">
      <legend className="text-muted-foreground px-1 text-xs font-semibold tracking-wide uppercase">
        Integración con GitHub
      </legend>

      <div role="radiogroup" aria-labelledby={groupId} className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const id = `${idPrefix}-mode-${opt.value}`
          const checked = mode === opt.value
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-xs transition-colors',
                checked
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <input
                id={id}
                type="radio"
                name="github_sync_mode"
                value={opt.value}
                checked={checked}
                onChange={() => setMode(opt.value)}
                className="sr-only"
              />
              <span className="text-foreground flex items-center gap-1.5 font-medium">
                {opt.icon}
                {opt.title}
              </span>
              <span className="text-muted-foreground text-[11px] leading-snug">
                {opt.description}
              </span>
            </label>
          )
        })}
      </div>

      {showRepo ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Repositorio" htmlFor={`${idPrefix}-repo`} required>
            {/* ── Loading state ── */}
            {(repoLoadState === 'idle' || repoLoadState === 'loading') && (
              <Select id={`${idPrefix}-repo`} disabled value="">
                <option value="">Cargando repositorios de la org…</option>
              </Select>
            )}

            {/* ── Org selector ── */}
            {repoLoadState === 'ok' && !isManualEntry && (
              <>
                <input type="hidden" name="github_repo" value={selectedRepoUrl} />
                <Select
                  id={`${idPrefix}-repo`}
                  value={selectedRepoUrl}
                  onChange={(e) => setSelectedRepoUrl(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Seleccionar repositorio…
                  </option>
                  {orgRepos.map((r) => (
                    <option key={r.id} value={r.html_url}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground self-start text-[11px]"
                  onClick={() => {
                    setIsManualEntry(true)
                    setSelectedRepoUrl('')
                  }}
                >
                  Introducir URL manualmente…
                </button>
              </>
            )}

            {/* ── Manual URL entry (error fallback or user chose manual) ── */}
            {(repoLoadState === 'error' || isManualEntry) && (
              <div className="flex flex-col gap-1.5">
                <Input
                  id={`${idPrefix}-repo`}
                  name="github_repo"
                  type="url"
                  inputMode="url"
                  required
                  value={selectedRepoUrl}
                  onChange={(e) => setSelectedRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  autoFocus={isManualEntry && repoLoadState === 'ok'}
                />
                {repoLoadState === 'ok' && orgRepos.length > 0 && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground self-start text-[11px]"
                    onClick={() => {
                      setIsManualEntry(false)
                      setSelectedRepoUrl(
                        orgRepos.find((r) => r.html_url === defaultRepoUrl)?.html_url ?? '',
                      )
                    }}
                  >
                    ← Seleccionar de la org
                  </button>
                )}
              </div>
            )}
          </Field>

          {showSync ? (
            <Field
              label="Installation ID de la GitHub App"
              htmlFor={`${idPrefix}-installation`}
              hint="Necesario para que el backoffice pueda escribir."
              required
            >
              <Input
                id={`${idPrefix}-installation`}
                name="github_installation_id"
                inputMode="numeric"
                required
                defaultValue={defaultInstallationId ?? ''}
                placeholder="123456"
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {showSync ? (
        <label className="border-border bg-background flex items-center gap-2 rounded-md border p-2.5 text-xs">
          <input
            type="checkbox"
            name="github_auto_sync"
            defaultChecked={defaultAutoSync}
            className="border-border text-primary focus:ring-primary size-4 rounded focus:ring-1"
          />
          <span className="flex-1">
            <span className="font-medium">Auto-crear issues</span>
            <span className="text-muted-foreground ml-1">
              al añadir tareas desde el backoffice.
            </span>
          </span>
        </label>
      ) : null}

      <details className="border-border bg-background/60 rounded-md border text-xs">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-3 py-2 font-medium select-none">
          ¿Qué ocurre en GitHub en cada modo?
        </summary>
        <div className="border-border overflow-x-auto border-t">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">Acción en backoffice</th>
                <th className="px-3 py-1.5 font-medium">Sin GitHub</th>
                <th className="px-3 py-1.5 font-medium">Solo enlace</th>
                <th className="px-3 py-1.5 font-medium">Sincronización</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {HELP_ROWS.map((row) => (
                <tr key={row.action}>
                  <td className="text-foreground px-3 py-1.5 font-medium">{row.action}</td>
                  <td className="text-muted-foreground px-3 py-1.5">{row.none}</td>
                  <td className="text-muted-foreground px-3 py-1.5">{row.link}</td>
                  <td className="text-muted-foreground px-3 py-1.5">{row.full}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </fieldset>
  )
}

const HELP_ROWS: Array<{ action: string; none: string; link: string; full: string }> = [
  {
    action: 'Crear tarea',
    none: '—',
    link: 'Botón para abrir issue prellenado en GitHub.com',
    full: 'Crea issue automáticamente',
  },
  {
    action: 'Recibir webhook',
    none: 'Ignorado',
    link: 'Ignorado',
    full: 'Actualiza tarea local',
  },
]

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase"
      >
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-muted-foreground text-[11px]">{hint}</p> : null}
    </div>
  )
}
