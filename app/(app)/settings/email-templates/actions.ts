'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole } from '@/lib/auth'
import { extractVariables } from '@/lib/email/templates'
import { createServerClient } from '@/lib/supabase/server'

const TemplateInput = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  slug: z
    .string()
    .min(1, 'El slug es obligatorio')
    .max(80)
    .regex(/^[a-z0-9_-]+$/, 'Solo minúsculas, números, guiones y guiones bajos'),
  subject: z.string().min(1, 'El asunto es obligatorio').max(200),
  body_html: z.string().min(1, 'El cuerpo es obligatorio'),
  include_signature: z.boolean().default(true),
})

export type EmailTemplateInput = z.infer<typeof TemplateInput>

export type EmailTemplate = {
  id: string
  name: string
  slug: string
  subject: string
  body_html: string
  variables: string[]
  include_signature: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  await requireRole(['owner', 'admin'])
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select(
      'id, name, slug, subject, body_html, variables, include_signature, active, created_at, updated_at',
    )
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as EmailTemplate[]
}

export async function createEmailTemplate(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireRole(['owner', 'admin'])
  const parsed = TemplateInput.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }

  const variables = extractVariables(parsed.data.body_html)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('email_templates')
    .insert({ ...parsed.data, variables, created_by: user.id })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/email')
  return { ok: true, id: data.id as string }
}

export async function updateEmailTemplate(
  id: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(['owner', 'admin'])
  const parsed = TemplateInput.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }

  const variables = extractVariables(parsed.data.body_html)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('email_templates')
    .update({ ...parsed.data, variables, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/email')
  return { ok: true }
}

export async function toggleEmailTemplateActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(['owner', 'admin'])
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('email_templates')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/email')
  return { ok: true }
}

export async function deleteEmailTemplate(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(['owner', 'admin'])
  const supabase = await createServerClient()
  const { error } = await supabase.from('email_templates').delete().eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/email')
  return { ok: true }
}
