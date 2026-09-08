'use server'

import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

// ---- Asset actions (moved from /assets) ----

export async function deleteAsset(id: string): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!['owner', 'admin'].includes(user.role)) return { error: 'Sin permiso' }

  const supabase = await createServerClient()
  const { data: asset, error: fetchError } = await supabase
    .from('brand_assets')
    .select('storage_path')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError || !asset) return { error: 'Asset no encontrado' }

  const { error: dbError } = await supabase
    .from('brand_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (dbError) return { error: dbError.message }

  const admin = createAdminClient()
  await admin.storage.from('brand-assets').remove([asset.storage_path])
  return {}
}

// ---- Token actions ----

const TokenInput = z.object({
  id: z.string().uuid().optional(),
  token_group: z.enum(['color', 'typography', 'spacing', 'radius', 'shadow']),
  key: z.string().min(1).max(80),
  value: z.string().min(1).max(400),
  value_dark: z.string().max(400).optional(),
  description: z.string().max(300).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
})

const GuideInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  content: z.string().min(1).max(12000),
  status: z.enum(['draft', 'published', 'archived']),
  sort_order: z.number().int().min(0).max(9999),
})

export const upsertToken = defineAction({
  name: 'brand.tokens.upsert',
  schema: TokenInput,
  roles: ['owner', 'admin'],
  revalidate: () => ['/brand'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const payload = {
      token_group: input.token_group,
      key: input.key,
      value: input.value,
      value_dark: input.value_dark ?? null,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase.from('brand_tokens').update(payload).eq('id', input.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('brand_tokens').insert(payload)
      if (error) throw new Error(error.message)
    }
  },
})

export const deleteToken = defineAction({
  name: 'brand.tokens.delete',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin'],
  revalidate: () => ['/brand'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase.from('brand_tokens').delete().eq('id', input.id)
    if (error) throw new Error(error.message)
  },
})

// ---- Editorial guides ----

export const upsertGuide = defineAction({
  name: 'brand.guides.upsert',
  schema: GuideInput,
  roles: ['owner', 'admin'],
  revalidate: () => ['/brand'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const now = new Date().toISOString()
    const payload = {
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      content: input.content,
      status: input.status,
      sort_order: input.sort_order,
      published_at: input.status === 'published' ? now : null,
      updated_at: now,
    }
    const query = input.id
      ? supabase.from('brand_guides').update(payload).eq('id', input.id)
      : supabase.from('brand_guides').insert(payload)
    const { error } = await query
    if (error) throw new Error(error.message)
  },
})

export const deleteGuide = defineAction({
  name: 'brand.guides.delete',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin'],
  revalidate: () => ['/brand'],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { error } = await supabase.from('brand_guides').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
})
