import { Inbox, Plus, Settings } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ListControls } from '@/components/layout/list-controls'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty-state'
import { SectionBoundary } from '@/components/ui/error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { requireUser } from '@/lib/auth'
import {
  type MediaKind,
  PLATFORM_LABELS,
  type PostStatus,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '@/lib/social/core'
import {
  filterAndSortPosts,
  SOCIAL_POST_SORT_OPTIONS,
  type SocialPostSort,
} from '@/lib/social/list'
import { listPosts } from '@/lib/social/repo'
import { availablePlatforms } from '@/lib/social/service'
import { SOCIAL_POST_STATUS } from '@/lib/status'
import { cn } from '@/lib/utils'
import { parseEnumParam, parseStringParam } from '@/lib/utils/search-params'

import { ImportInstagramButton } from './_components/import-instagram-button'
import { PlatformIcon } from './_components/platform'
import { PostCard } from './_components/post-card'
import { SyncButton } from './_components/sync-button'

const STATUS_OPTIONS = Object.entries(SOCIAL_POST_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

const PLATFORM_OPTIONS = SOCIAL_PLATFORMS.map((platform) => ({
  value: platform,
  label: PLATFORM_LABELS[platform],
}))

const MEDIA_OPTIONS = [
  { value: 'text', label: 'Texto' },
  { value: 'photo', label: 'Imagen' },
  { value: 'video', label: 'Vídeo' },
  { value: 'carousel', label: 'Carrusel' },
] satisfies { value: MediaKind; label: string }[]

const SORT_OPTIONS = SOCIAL_POST_SORT_OPTIONS.map(({ value, label }) => ({ value, label }))

const POST_STATUS_VALUES = Object.keys(SOCIAL_POST_STATUS) as PostStatus[]
const MEDIA_KIND_VALUES = MEDIA_OPTIONS.map(({ value }) => value)
const SORT_VALUES = SOCIAL_POST_SORT_OPTIONS.map(({ value }) => value)
const SKELETON_IDS = ['one', 'two', 'three', 'four']

type SocialPageSearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata: Metadata = { title: 'Social · doscientos' }
export const dynamic = 'force-dynamic'

/** Compact strip showing which networks are connected (env-configured). */
function Connections() {
  const available = new Set(availablePlatforms())
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SOCIAL_PLATFORMS.map((p) => {
        const on = available.has(p)
        return (
          <span
            key={p}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
              on
                ? 'bg-success/10 text-success ring-success/20'
                : 'bg-muted text-muted-foreground ring-border',
            )}
            title={on ? 'Conectado' : 'Sin configurar'}
          >
            <PlatformIcon platform={p} className="size-3.5" />
            {PLATFORM_LABELS[p]}
            <span
              className={cn('size-1.5 rounded-full', on ? 'bg-success' : 'bg-muted-foreground/40')}
            />
          </span>
        )
      })}
    </div>
  )
}
async function PostsList({
  filters,
  hasFilters,
}: {
  filters: {
    q: string
    status: PostStatus | null
    platform: SocialPlatform | null
    mediaKind: MediaKind | null
    sort: SocialPostSort
  }
  hasFilters: boolean
}) {
  const allPosts = await listPosts()
  const posts = filterAndSortPosts(allPosts, filters)
  if (posts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Plus />
          </EmptyMedia>
          <EmptyTitle>
            {hasFilters
              ? 'No hay publicaciones con estos filtros.'
              : 'Aún no has creado ninguna publicación.'}
          </EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Prueba a cambiar o limpiar los filtros para ver otras publicaciones.'
              : 'Redacta un post una vez y publícalo en todas tus redes conectadas a la vez.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="sm">
            <Link href="/social/compose">
              <Plus className="size-4" />
              Crear publicación
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        {hasFilters ? `Mostrando ${posts.length} de ${allPosts.length}` : posts.length}{' '}
        {posts.length === 1 ? 'publicación' : 'publicaciones'}
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {SKELETON_IDS.map((id) => (
        <div key={id} className="border-border bg-card flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex gap-3">
            <Skeleton className="size-20 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: SocialPageSearchParams
}) {
  await requireUser()
  const sp = await searchParams
  const q = parseStringParam(sp, 'q')
  const status = parseEnumParam(sp, 'status', POST_STATUS_VALUES)
  const platform = parseEnumParam(sp, 'platform', SOCIAL_PLATFORMS)
  const mediaKind = parseEnumParam(sp, 'media', MEDIA_KIND_VALUES)
  const sort = parseEnumParam(sp, 'sort', SORT_VALUES) ?? 'created_desc'
  const filters = { q, status, platform, mediaKind, sort }
  const hasFilters = Boolean(q || status || platform || mediaKind || sort !== 'created_desc')
  const available = availablePlatforms()
  const instagramConnected = available.includes('instagram')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Social"
        description="Publica en todas tus redes desde un único sitio."
        actions={
          <>
            {instagramConnected && <ImportInstagramButton />}
            <SyncButton kind="insights" label="Sincronizar métricas" />
            <Button asChild variant="outline" size="sm">
              <Link href="/social/feed/inbox">
                <Inbox className="size-4" />
                Comentarios
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/social/automation">
                <Settings className="size-4" />
                Automatizaciones
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/social/compose">
                <Plus className="size-4" />
                Nueva publicación
              </Link>
            </Button>
          </>
        }
      />
      <Connections />
      <ListControls
        searchKey="q"
        searchPlaceholder="Buscar por texto…"
        filters={[
          { key: 'status', label: 'Estado', options: STATUS_OPTIONS },
          { key: 'platform', label: 'Red', options: PLATFORM_OPTIONS },
          { key: 'media', label: 'Contenido', options: MEDIA_OPTIONS },
          { key: 'sort', label: 'Ordenar', options: SORT_OPTIONS },
        ]}
        className="border-border bg-card rounded-xl border"
      />
      <SectionBoundary pending={<ListSkeleton />} label="No se pudieron cargar las publicaciones">
        <PostsList filters={filters} hasFilters={hasFilters} />
      </SectionBoundary>
    </div>
  )
}
