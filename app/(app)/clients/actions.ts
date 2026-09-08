/* eslint-disable @typescript-eslint/no-unused-vars */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { defineAction } from '@/lib/actions/define-action'
import { requireUser } from '@/lib/auth'
import { validateAndRecordClientFiscalIdentity } from '@/lib/clients/fiscal-verification'
import type { FiscalVerificationStatus } from '@/lib/clients/types'
import { VersionConflictError } from '@/lib/concurrency/version-conflict'
import { findCompanyByCif, getCompanyDetails, isCifNumber } from '@/lib/openmercantil/client'
import {
  CreateClientInput,
  UpdateClientInput,
  ValidateClientFiscalIdentityInput,
} from '@/lib/schemas/client'
import { uuidIdInput } from '@/lib/schemas/common'
import { createServerClient } from '@/lib/supabase/server'
import { type ViesResult, validateVatVies } from '@/lib/vies/client'
import { validateNifEs } from '@/lib/vies/nif'

function canVerifySpanishFiscalIdentity(input: {
  name: string
  nif?: string | undefined
  billing_address_country?: string | undefined
}) {
  return (
    input.name.trim().length > 0 &&
    Boolean(input.nif?.trim()) &&
    (input.billing_address_country ?? 'ES').trim().toUpperCase() === 'ES'
  )
}

async function refreshFiscalVerification(clientId: string, userId: string) {
  try {
    await validateAndRecordClientFiscalIdentity(clientId, userId)
  } catch {
    // The client remains unverified so an F1 cannot be issued until AEAT is available.
  }
}

// ---------- CREATE ----------
// Kept as a redirect-based form action: `<form action={createClient}>`.
// Errors throw and surface via the closest error boundary, matching the
// pre-existing behaviour. Schema is centralised in lib/schemas/client.

export async function createClient(formData: FormData): Promise<void> {
  const user = await requireUser()
  const raw = {
    name: formData.get('name')?.toString() ?? '',
    nif: formData.get('nif')?.toString() ?? '',
    email: formData.get('email')?.toString() ?? '',
    phone: formData.get('phone')?.toString() ?? '',
    billing_address_street: formData.get('billing_address_street')?.toString() ?? '',
    billing_address_zip: formData.get('billing_address_zip')?.toString() ?? '',
    billing_address_city: formData.get('billing_address_city')?.toString() ?? '',
    billing_address_province: formData.get('billing_address_province')?.toString() ?? '',
    billing_address_country: formData.get('billing_address_country')?.toString() ?? 'ES',
    contact_person: formData.get('contact_person')?.toString() ?? '',
    notes: formData.get('notes')?.toString() ?? '',
    logo_url: formData.get('logo_url')?.toString() ?? '',
  }
  const parsed = CreateClientInput.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Datos no válidos')

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: parsed.data.name,
      label: parsed.data.label ?? null,
      nif: parsed.data.nif ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      billing_address_street: parsed.data.billing_address_street ?? null,
      billing_address_zip: parsed.data.billing_address_zip ?? null,
      billing_address_city: parsed.data.billing_address_city ?? null,
      billing_address_province: parsed.data.billing_address_province ?? null,
      billing_address_country: parsed.data.billing_address_country ?? 'ES',
      contact_person: parsed.data.contact_person ?? null,
      notes: parsed.data.notes ?? null,
      logo_url: parsed.data.logo_url ?? null,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el cliente')
  if (canVerifySpanishFiscalIdentity(parsed.data)) {
    await refreshFiscalVerification(data.id, user.id)
  }
  revalidatePath('/clients')
  redirect(`/clients/${data.id}`)
}

// ---------- UPDATE ----------
// Public, backward-compatible input shape for callers (form values are
// all-strings). The schema in lib/schemas/client validates + coerces "" to
// undefined for optional fields before the handler runs.
export type UpdateClientInputType = {
  id: string
  name: string
  nif: string
  email: string
  phone: string
  billing_address_street: string
  billing_address_zip: string
  billing_address_city: string
  billing_address_province: string
  billing_address_country: string
  contact_person: string
  notes: string
}

export const updateClient = defineAction({
  name: 'clients.update',
  schema: UpdateClientInput,
  revalidate: (_payload, input) => [`/clients/${input.id}`, '/clients'],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()
    const { id, expected_version, ...patch } = input
    const { data: current, error: currentError } = await supabase
      .from('clients')
      .select('name, nif, billing_address_country')
      .eq('id', id)
      .eq('version', expected_version)
      .maybeSingle()
    if (currentError) throw new Error(currentError.message)
    const fiscalDetailsChanged =
      current !== null &&
      (patch.name !== current.name ||
        (patch.nif ?? null) !== current.nif ||
        (patch.billing_address_country ?? 'ES') !== (current.billing_address_country ?? 'ES'))
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: patch.name,
        label: patch.label ?? null,
        nif: patch.nif ?? null,
        email: patch.email ?? null,
        phone: patch.phone ?? null,
        billing_address_street: patch.billing_address_street ?? null,
        billing_address_zip: patch.billing_address_zip ?? null,
        billing_address_city: patch.billing_address_city ?? null,
        billing_address_province: patch.billing_address_province ?? null,
        billing_address_country: patch.billing_address_country ?? 'ES',
        contact_person: patch.contact_person ?? null,
        notes: patch.notes ?? null,
        logo_url: patch.logo_url ?? null,
      })
      .eq('id', id)
      .eq('version', expected_version)
      .select('version')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new VersionConflictError()
    if (fiscalDetailsChanged && canVerifySpanishFiscalIdentity(patch)) {
      await refreshFiscalVerification(id, user.id)
    }
    return { version: Number(data.version) }
  },
})

export const validateClientFiscalIdentity = defineAction<
  typeof ValidateClientFiscalIdentityInput,
  { status: FiscalVerificationStatus; aeatName: string | null; message: string }
>({
  name: 'clients.validateFiscalIdentity',
  schema: ValidateClientFiscalIdentityInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: (_payload, input) => [`/clients/${input.clientId}`, '/clients'],
  handler: ({ clientId }, { user }) => validateAndRecordClientFiscalIdentity(clientId, user.id),
})

// ---------- DELETE ----------
// Soft-deletes a client by stamping `deleted_at`. The list and detail queries
// filter on `deleted_at is null`, so the row disappears from the UI while
// remaining recoverable from the database (mirrors projects/proposals).
export const deleteClient = defineAction({
  name: 'clients.delete',
  schema: uuidIdInput,
  revalidate: () => ['/clients'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  },
})

// ---------- VAT / NIF VALIDATION ----------
// Called client-side (via server action) from the NIF input field.
// Returns a serialisable result — no throws — so the caller can render inline
// feedback without an error boundary.
//
// Validation priority:
//   Spanish identifiers (NIF / NIE / CIF, with or without "ES" prefix)
//     1. Offline checksum — instant, no network, covers NIF · NIE · CIF
//     2. OpenMercantil (Registro Mercantil / BORME) — for CIFs only
//     3. Checksum-confirmed valid — returned when OpenMercantil has no record
//        (small / recently dissolved companies, or NIF/NIE individuals)
//   Non-Spanish EU identifiers
//     → VIES intra-community registry
export async function validateVat(nif: string): Promise<ViesResult> {
  await requireUser()
  const raw = nif.trim()
  if (!raw) {
    return { valid: false, reason: 'invalid', message: 'Introduce un NIF/CIF/VAT primero.' }
  }

  // Determine country code and local number.
  const normalized = raw.toUpperCase().replace(/[\s.-]/g, '')
  const hasEsPrefix = normalized.startsWith('ES')
  const hasOtherEuPrefix = !hasEsPrefix && normalized.length >= 2 && /^[A-Z]{2}/.test(normalized)
  const localNum = hasEsPrefix
    ? normalized.slice(2)
    : hasOtherEuPrefix
      ? normalized.slice(2)
      : normalized
  const isSpanish = hasEsPrefix || !hasOtherEuPrefix

  if (isSpanish) {
    // 1. Offline checksum — covers NIF (DNI), NIE and CIF
    const offlineCheck = validateNifEs(localNum)
    if (!offlineCheck.valid) {
      return { valid: false, reason: 'invalid', message: offlineCheck.message }
    }

    // 2. Registro Mercantil lookup — only meaningful for CIFs (empresas)
    if (isCifNumber(localNum)) {
      const company = await findCompanyByCif(localNum)
      if (company) {
        const details = await getCompanyDetails(company.slug)
        return {
          valid: true,
          countryCode: 'ES',
          vatNumber: localNum,
          name: details?.name ?? company.name,
          source: 'openmercantil',
          companyStatus: details?.status ?? company.status,
          province: details?.province,
          city: details?.city,
          address: details?.address,
          companyType: details?.companyType,
          officers: details?.officers?.length ? details.officers : undefined,
        }
      }
    }

    // 3. Checksum passed but no registry record (NIF/NIE individual, or CIF not
    //    yet indexed) — the format is legally valid, just not intra-EU registered.
    return {
      valid: true,
      countryCode: 'ES',
      vatNumber: localNum,
      source: 'es-checksum',
    }
  }

  // Non-Spanish EU VAT numbers → VIES
  return validateVatVies(raw)
}

// Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
// shown after `deleteClient`, restoring the row to the list/detail views.
export const restoreClient = defineAction({
  name: 'clients.restore',
  schema: uuidIdInput,
  revalidate: (_payload, input) => [`/clients/${input.id}`, '/clients'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase.from('clients').update({ deleted_at: null }).eq('id', input.id)
    if (error) throw new Error(error.message)
  },
})
