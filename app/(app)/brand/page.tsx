import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import type { BrandAsset } from './_components/assets-grid'
import { BrandHub } from './_components/brand-hub'
import type { BrandGuide } from './_components/guides-panel'
import type { BrandToken } from './_components/token-edit-dialog'

export const metadata: Metadata = { title: 'Marca · doscientos' }
export const dynamic = 'force-dynamic'

export default async function BrandPage() {
  const user = await requireUser()
  const supabase = await createServerClient()

  const [assetsResult, tokensResult, guidesResult] = await Promise.all([
    supabase
      .from('brand_assets')
      .select('id, name, description, category, mime_type, size_bytes, public_url, created_at')
      .is('deleted_at', null)
      .order('category')
      .order('created_at', { ascending: false }),
    supabase
      .from('brand_tokens')
      .select('id, token_group, key, value, value_dark, description, sort_order')
      .order('token_group')
      .order('sort_order'),
    supabase
      .from('brand_guides')
      .select('id, slug, title, description, content, status, sort_order, published_at')
      .order('sort_order')
      .order('created_at'),
  ])

  const isAdmin = user.role === 'owner' || user.role === 'admin'

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Marca"
        description="Assets visuales, tokens de diseño y exportación para nuevos proyectos."
        className="shrink-0"
        actions={
          user.role !== 'viewer' ? (
            <Button asChild size="sm">
              <Link href="/brand/new">
                <Plus className="size-3.5" />
                Subir asset
              </Link>
            </Button>
          ) : undefined
        }
      />

      {assetsResult.error || tokensResult.error || guidesResult.error ? (
        <p className="text-destructive text-sm">
          {assetsResult.error?.message ??
            tokensResult.error?.message ??
            guidesResult.error?.message}
        </p>
      ) : (
        <BrandHub
          assets={(assetsResult.data ?? []) as BrandAsset[]}
          tokens={(tokensResult.data ?? []) as BrandToken[]}
          guides={(guidesResult.data ?? []) as BrandGuide[]}
          isAdmin={isAdmin}
          className="min-h-0 flex-1"
        />
      )}
    </div>
  )
}
