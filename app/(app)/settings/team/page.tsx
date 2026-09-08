import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { type MemberRole, requirePageRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, memberAvatarUrl, relativeTime } from '@/lib/utils'

import { InviteForm } from './invite-form'
import { MemberProfileDialog } from './member-profile-dialog'
import { MemberRowActions } from './member-row-actions'

export const metadata = { title: 'Equipo · doscientos' }
export const dynamic = 'force-dynamic'

const INACTIVE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Solo lectura',
}

const ROLE_VARIANT: Record<MemberRole, 'default' | 'info' | 'neutral'> = {
  owner: 'default',
  admin: 'info',
  member: 'neutral',
  viewer: 'neutral',
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

type MemberRow = {
  id: string
  name: string
  email: string
  role: MemberRole
  created_at: string
  deleted_at: string | null
  avatar_url: string | null
  github_handle: string | null
  job_title: string | null
  phone: string | null
  contact_email: string | null
  email_alias: string | null
  leads_assignable: boolean
  last_sign_in_at: string | null
  /** null = invite not yet accepted (token not confirmed) */
  confirmed_at: string | null
}

export default async function TeamSettingsPage() {
  const actor = await requirePageRole(['owner', 'admin'])
  const [supabase, admin] = await Promise.all([
    createServerClient(),
    Promise.resolve(createAdminClient()),
  ])

  const [{ data, error }, { data: authData }] = await Promise.all([
    supabase
      .from('team_members')
      .select(
        'id, name, email, role, created_at, deleted_at, avatar_url, github_handle, job_title, phone, contact_email, email_alias, leads_assignable',
      )
      .order('deleted_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const lastSignInMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  )
  const confirmedAtMap = new Map((authData?.users ?? []).map((u) => [u.id, u.confirmed_at ?? null]))

  const members: MemberRow[] = (data ?? []).map((m) => ({
    ...(m as Omit<MemberRow, 'last_sign_in_at' | 'confirmed_at'>),
    last_sign_in_at: lastSignInMap.get(m.id as string) ?? null,
    confirmed_at: confirmedAtMap.get(m.id as string) ?? null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipo"
        description="Gestiona los miembros de tu organización, sus roles y el acceso al backoffice."
      />

      <Card>
        <CardHeader>
          <CardTitle>Invitar miembro</CardTitle>
          <CardDescription>
            Le enviaremos un email con un enlace de acceso. Entrará directamente sin necesidad de
            contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm actorRole={actor.role} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'miembro' : 'miembros'} en total.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <p className="text-danger px-5 py-6 text-sm">{error.message}</p>
          ) : members.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Aún no hay miembros</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs tracking-wide text-(--text-muted) uppercase">
                  <tr>
                    <th className="px-5 py-2 font-medium">Miembro</th>
                    <th className="px-5 py-2 font-medium">Rol</th>
                    <th className="px-5 py-2 font-medium">Estado</th>
                    <th className="px-5 py-2 font-medium whitespace-nowrap">Incorporación</th>
                    <th
                      className="px-5 py-2 font-medium whitespace-nowrap"
                      title="Fecha del último inicio de sesión explícito (clic en magic link). Las renovaciones automáticas de sesión no actualizan este valor."
                    >
                      Último inicio de sesión
                    </th>
                    <th className="px-5 py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isSelf = m.id === actor.id
                    const isDeactivated = m.deleted_at !== null
                    const isPending = !isDeactivated && !m.confirmed_at
                    return (
                      <tr key={m.id} className="border-border border-t hover:bg-(--surface-hover)">
                        <td className="px-5 py-2.5 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-7 shrink-0">
                              {memberAvatarUrl({
                                avatarUrl: m.avatar_url,
                                githubHandle: m.github_handle,
                              }) ? (
                                <AvatarImage
                                  src={memberAvatarUrl({
                                    avatarUrl: m.avatar_url,
                                    githubHandle: m.github_handle,
                                  })!}
                                  alt={m.name}
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                              <AvatarFallback>{initials(m.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/team/${m.id}`}
                                className="hover:text-primary block truncate font-medium transition-colors"
                              >
                                {m.name}
                                {isSelf ? (
                                  <span className="ml-2 text-xs text-(--text-muted)">(tú)</span>
                                ) : null}
                              </Link>
                              <div className="truncate text-xs text-(--text-muted)">{m.email}</div>
                            </div>
                            {actor.role === 'owner' || actor.role === 'admin' ? (
                              <MemberProfileDialog
                                member={{
                                  id: m.id,
                                  name: m.name,
                                  email: m.email,
                                  avatarUrl: m.avatar_url,
                                  githubHandle: m.github_handle,
                                  jobTitle: m.job_title,
                                  phone: m.phone,
                                  contactEmail: m.contact_email,
                                  emailAlias: m.email_alias,
                                }}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          <Badge variant={ROLE_VARIANT[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          {isDeactivated ? (
                            <Badge variant="danger">Desactivado</Badge>
                          ) : isPending ? (
                            <Badge variant="warning">Pendiente</Badge>
                          ) : (
                            <Badge variant="success">Activo</Badge>
                          )}
                        </td>
                        <td className="px-5 py-2.5 align-middle whitespace-nowrap text-(--text-secondary)">
                          {formatDate(m.created_at)}
                        </td>
                        <td className="px-5 py-2.5 align-middle whitespace-nowrap">
                          {m.last_sign_in_at ? (
                            <span
                              className={
                                Date.now() - new Date(m.last_sign_in_at).getTime() >
                                INACTIVE_THRESHOLD_MS
                                  ? 'text-warning font-medium'
                                  : 'text-(--text-secondary)'
                              }
                              title={formatDate(m.last_sign_in_at)}
                            >
                              {relativeTime(m.last_sign_in_at)}
                            </span>
                          ) : (
                            <span className="text-(--text-muted)">Nunca</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          <MemberRowActions
                            memberId={m.id}
                            memberEmail={m.email}
                            role={m.role}
                            isSelf={isSelf}
                            isDeactivated={isDeactivated}
                            isPending={isPending}
                            actorRole={actor.role}
                            leadsAssignable={m.leads_assignable}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
