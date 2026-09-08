import { validateSpanishFiscalIdentity } from '@/lib/aeat/nif-validation'
import type { FiscalVerificationStatus } from '@/lib/clients/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifactuInvoiceConfigFromEnv } from '@/lib/verifactu/config'
import { validateNifEs } from '@/lib/vies/nif'

type Result = {
  status: Exclude<FiscalVerificationStatus, 'unverified'>
  aeatName: string | null
  message: string
}

export async function validateAndRecordClientFiscalIdentity(
  clientId: string,
  checkedBy: string,
): Promise<Result> {
  const admin = createAdminClient()
  const { data: client, error } = await admin
    .from('clients')
    .select('id, nif, name, billing_address_country')
    .eq('id', clientId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !client) throw new Error(error?.message ?? 'Cliente no encontrado')

  const submittedNif = String(client.nif ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')
  const aeatNif = submittedNif.startsWith('ES') ? submittedNif.slice(2) : submittedNif
  const name = String(client.name ?? '').trim()
  const country = String(client.billing_address_country ?? 'ES')
    .trim()
    .toUpperCase()
  let status: Result['status']
  let aeatName: string | null = null
  let aeatResult: string | null = null
  let message: string

  if (country !== 'ES') {
    status = 'not_applicable'
    message = 'La comprobación VNifV2 solo cubre destinatarios españoles.'
  } else if (!submittedNif || !name) {
    status = 'invalid'
    message = 'Introduce NIF y razón social antes de validar.'
  } else {
    const local = validateNifEs(aeatNif)
    if (!local.valid) {
      status = 'invalid'
      message = local.message
    } else {
      const result = await validateSpanishFiscalIdentity(
        { nif: aeatNif, name },
        verifactuInvoiceConfigFromEnv().certificate,
      )
      status = result.status
      aeatName = result.aeatName
      aeatResult = result.aeatResult
      message = result.message
    }
  }

  const { error: recordError } = await admin.rpc('record_client_fiscal_verification', {
    p_client_id: clientId,
    p_submitted_nif: aeatNif,
    p_submitted_name: name,
    p_status: status,
    p_aeat_name: aeatName,
    p_aeat_result: aeatResult,
    p_detail: message,
    p_checked_by: checkedBy,
  })
  if (recordError) throw new Error(recordError.message)
  return { status, aeatName, message }
}

export async function ensureInvoiceRecipientVerified(invoiceId: string, _checkedBy: string) {
  const admin = createAdminClient()
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('invoice_type, client_id')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !invoice) throw new Error(error?.message ?? 'Factura no encontrada')
  if (invoice.invoice_type !== 'F1') return
  if (!invoice.client_id) throw new Error('La factura F1 no tiene destinatario fiscal')

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select(
      'nif, name, billing_address_country, fiscal_verification_status, fiscal_verified_nif, fiscal_verified_name, fiscal_verified_at',
    )
    .eq('id', invoice.client_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (clientError || !client) throw new Error(clientError?.message ?? 'Cliente no encontrado')

  const country = String(client.billing_address_country ?? 'ES')
    .trim()
    .toUpperCase()
  const nif = String(client.nif ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')
    .replace(/^ES/, '')
  const name = String(client.name ?? '').trim()
  if (country !== 'ES') {
    throw new Error(
      'Las facturas F1 para destinatarios extranjeros requieren soporte de identificación extranjera antes de regularizarse',
    )
  }
  if (!nif || !name) throw new Error('Una factura F1 requiere NIF y razón social del destinatario')
  if (
    client.fiscal_verification_status !== 'verified' ||
    client.fiscal_verified_at === null ||
    client.fiscal_verified_nif !== nif ||
    client.fiscal_verified_name !== name
  ) {
    throw new Error(
      'El NIF y la razón social del destinatario deben validarse con AEAT antes de regularizar una factura F1',
    )
  }
}
