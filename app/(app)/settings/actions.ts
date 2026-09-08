'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole, requireUser } from '@/lib/auth'
import { serverEnv } from '@/lib/env'
import { createServerClient } from '@/lib/supabase/server'

const ProfileInput = z.object({
  email_alias: z
    .string()
    .email('Alias no válido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  github_handle: z
    .string()
    .max(39)
    .regex(/^[a-zA-Z0-9-]*$/, 'Handle de GitHub inválido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  job_title: z
    .string()
    .max(160)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  contact_email: z
    .string()
    .email('Email de contacto no válido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export async function updateProfile(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()
  const raw = {
    email_alias: formData.get('email_alias')?.toString() ?? '',
    github_handle: formData.get('github_handle')?.toString() ?? '',
    job_title: formData.get('job_title')?.toString() ?? '',
    phone: formData.get('phone')?.toString() ?? '',
    contact_email: formData.get('contact_email')?.toString() ?? '',
  }
  const parsed = ProfileInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('team_members')
    .update({
      email_alias: parsed.data.email_alias ?? null,
      github_handle: parsed.data.github_handle ?? null,
      job_title: parsed.data.job_title ?? null,
      phone: parsed.data.phone ?? null,
      contact_email: parsed.data.contact_email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505' && error.message.includes('github_handle')) {
      return { ok: false, error: 'Ese handle de GitHub ya lo usa otro miembro del equipo.' }
    }
    return { ok: false, error: error.message }
  }
  revalidatePath('/settings/profile')
  return { ok: true }
}

// ---------- Owner: edit any member's profile ----------

const MemberProfileInput = z.object({
  member_id: z.string().uuid('ID no válido'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  github_handle: z
    .string()
    .max(39)
    .regex(/^[a-zA-Z0-9-]*$/, 'Handle de GitHub inválido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  job_title: z
    .string()
    .max(160)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  contact_email: z
    .string()
    .email('Email de contacto no válido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  email_alias: z
    .string()
    .email('Alias no válido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  avatar_url: z
    .string()
    .url('URL de avatar no válida')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export async function updateMemberProfile(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(['owner', 'admin'])
  const raw = {
    member_id: formData.get('member_id')?.toString() ?? '',
    name: formData.get('name')?.toString() ?? '',
    github_handle: formData.get('github_handle')?.toString() ?? '',
    job_title: formData.get('job_title')?.toString() ?? '',
    phone: formData.get('phone')?.toString() ?? '',
    contact_email: formData.get('contact_email')?.toString() ?? '',
    email_alias: formData.get('email_alias')?.toString() ?? '',
    avatar_url: formData.get('avatar_url')?.toString() ?? '',
  }
  const parsed = MemberProfileInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('team_members')
    .update({
      name: parsed.data.name,
      avatar_url: parsed.data.avatar_url ?? null,
      email_alias: parsed.data.email_alias ?? null,
      github_handle: parsed.data.github_handle ?? null,
      job_title: parsed.data.job_title ?? null,
      phone: parsed.data.phone ?? null,
      contact_email: parsed.data.contact_email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.member_id)

  if (error) {
    if (error.code === '23505' && error.message.includes('github_handle')) {
      return { ok: false, error: 'Ese handle de GitHub ya lo usa otro miembro del equipo.' }
    }
    return { ok: false, error: error.message }
  }
  revalidatePath('/settings/team')
  return { ok: true }
}

// ---------- Company settings ----------
const opt = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined))

const CompanyInput = z.object({
  company_name: z.string().min(1).max(160),
  company_nif: opt(20),
  company_address_street: opt(200),
  company_address_zip: opt(20),
  company_address_city: opt(100),
  company_address_province: opt(100),
  company_address_country: z.string().max(10).default('ES'),
  iban: opt(40),
  payment_terms: opt(4000),
  default_vat_rate: z.coerce.number().min(0).max(100),
  invoice_series: z.string().min(1).max(10),
  internal_hourly_cost: z.coerce.number().min(0).max(100000),
})

const GmailSyncMailboxesInput = z.object({
  mailboxes: z.array(z.string().trim().email('Introduce emails válidos')).max(30),
})

export async function updateGmailSyncMailboxes(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(['owner', 'admin'])
  const parsed = GmailSyncMailboxesInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const domain = serverEnv().GOOGLE_WORKSPACE_DOMAIN.toLowerCase()
  const mailboxes = [...new Set(parsed.data.mailboxes.map((email) => email.toLowerCase()))]
  if (mailboxes.some((email) => !email.endsWith(`@${domain}`))) {
    return { ok: false, error: `Los buzones deben pertenecer al dominio @${domain}.` }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('settings')
    .update({ gmail_sync_mailboxes: mailboxes, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings/email')
  revalidatePath('/leads')
  return { ok: true }
}

export async function updateCompanySettings(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(['owner', 'admin'])
  const raw = {
    company_name: formData.get('company_name')?.toString() ?? '',
    company_nif: formData.get('company_nif')?.toString() ?? '',
    company_address_street: formData.get('company_address_street')?.toString() ?? '',
    company_address_zip: formData.get('company_address_zip')?.toString() ?? '',
    company_address_city: formData.get('company_address_city')?.toString() ?? '',
    company_address_province: formData.get('company_address_province')?.toString() ?? '',
    company_address_country: formData.get('company_address_country')?.toString() ?? 'ES',
    iban: formData.get('iban')?.toString() ?? '',
    payment_terms: formData.get('payment_terms')?.toString() ?? '',
    default_vat_rate: formData.get('default_vat_rate')?.toString() ?? '21',
    invoice_series: formData.get('invoice_series')?.toString() ?? 'A',
    internal_hourly_cost: formData.get('internal_hourly_cost')?.toString() ?? '0',
  }
  const parsed = CompanyInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  // Compute the legacy freeform field so the PDF query keeps working without changes.
  const { formatAddress } = await import('@/lib/address')
  const company_address =
    formatAddress({
      street: parsed.data.company_address_street,
      zip: parsed.data.company_address_zip,
      city: parsed.data.company_address_city,
      province: parsed.data.company_address_province,
      country: parsed.data.company_address_country,
    }) || null

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('settings')
    .update({
      company_name: parsed.data.company_name,
      company_nif: parsed.data.company_nif ?? null,
      company_address_street: parsed.data.company_address_street ?? null,
      company_address_zip: parsed.data.company_address_zip ?? null,
      company_address_city: parsed.data.company_address_city ?? null,
      company_address_province: parsed.data.company_address_province ?? null,
      company_address_country: parsed.data.company_address_country,
      company_address,
      iban: parsed.data.iban ?? null,
      payment_terms: parsed.data.payment_terms ?? null,
      default_vat_rate: parsed.data.default_vat_rate,
      invoice_series: parsed.data.invoice_series,
      internal_hourly_cost: parsed.data.internal_hourly_cost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings/company')
  return { ok: true }
}
