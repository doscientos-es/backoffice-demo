/**
 * Drive backup orchestration for invoices and proposals.
 *
 * Each function is best-effort safe (never throws) and no-ops when Google is
 * not configured. Files are stored in client-named subfolders inside the root
 * folders configured via env vars.
 *
 * Folder structure:
 *   GOOGLE_DRIVE_INVOICES_FOLDER_ID/
 *     └── <ClientName>/
 *           ├── factura-A-2026-001.pdf
 *           └── factura-A-2026-001.json
 *   GOOGLE_DRIVE_PROPOSALS_FOLDER_ID/
 *     └── <ClientName>/
 *           └── propuesta-P-2026-003.json
 */
import 'server-only'
import { isGoogleEnabled, serverEnv } from '@/lib/env'
import { renderInvoicePdf } from '@/lib/invoices/invoice-pdf-document'
import { buildInvoicePdfData, invoicePdfFilename } from '@/lib/invoices/pdf-data'
import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

import { resolveSubject } from './client'
import { findOrCreateClientFolder, uploadBackupSafe } from './drive'

const log = scopedLogger('google.backup')

// ─── Invoice ──────────────────────────────────────────────────────────────────

export async function backupInvoiceToDrive(invoiceId: string, actorEmail?: string): Promise<void> {
  if (!isGoogleEnabled()) return
  const env = serverEnv()
  const rootFolderId = env.GOOGLE_DRIVE_INVOICES_FOLDER_ID
  if (!rootFolderId) return

  const sub = resolveSubject(actorEmail)

  try {
    const admin = createAdminClient()
    const [{ data: invoice }, { data: items }, { data: settings }] = await Promise.all([
      admin
        .from('invoices')
        .select('*, clients(id, name, logo_url)')
        .eq('id', invoiceId)
        .is('deleted_at', null)
        .maybeSingle(),
      admin.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('position'),
      admin
        .from('settings')
        .select('company_name, company_nif, company_address, iban')
        .eq('id', 1)
        .maybeSingle(),
    ])

    if (!invoice) {
      log.warn({ invoiceId }, 'drive_backup_invoice_not_found')
      return
    }

    const clientData = (
      invoice as unknown as { clients?: { name?: string; logo_url?: string | null } }
    ).clients
    const clientName = clientData?.name ?? 'Sin-Cliente'
    const clientLogoUrl = clientData?.logo_url ?? null
    const clientFolderId = await findOrCreateClientFolder({
      subject: sub,
      parentFolderId: rootFolderId,
      clientName,
    })

    const pdfData = await buildInvoicePdfData({
      invoice: invoice as Parameters<typeof buildInvoicePdfData>[0]['invoice'],
      clientName,
      clientLogoUrl,
      items: items ?? [],
      settings: settings ?? null,
    })
    const pdfBuffer = await renderInvoicePdf(pdfData)
    const pdfName = invoicePdfFilename(invoice.full_number as string | null, invoiceId)
    const jsonName = pdfName.replace(/\.pdf$/, '.json')

    await Promise.all([
      uploadBackupSafe({
        subject: sub,
        name: pdfName,
        mimeType: 'application/pdf',
        data: pdfBuffer,
        folderId: clientFolderId,
      }),
      uploadBackupSafe({
        subject: sub,
        name: jsonName,
        mimeType: 'application/json',
        data: Buffer.from(JSON.stringify(invoice, null, 2)),
        folderId: clientFolderId,
      }),
    ])
  } catch (err) {
    log.error({ err, invoiceId }, 'drive_backup_invoice_failed')
  }
}

// ─── Proposal ─────────────────────────────────────────────────────────────────

export async function backupProposalToDrive(
  proposalId: string,
  actorEmail?: string,
): Promise<void> {
  if (!isGoogleEnabled()) return
  const env = serverEnv()
  const rootFolderId = env.GOOGLE_DRIVE_PROPOSALS_FOLDER_ID
  if (!rootFolderId) return

  const sub = resolveSubject(actorEmail)

  try {
    const admin = createAdminClient()
    const [{ data: proposal }, { data: items }] = await Promise.all([
      admin
        .from('proposals')
        .select('*, clients(id, name, nif, billing_address), leads(name, email, company)')
        .eq('id', proposalId)
        .is('deleted_at', null)
        .maybeSingle(),
      admin.from('proposal_items').select('*').eq('proposal_id', proposalId).order('position'),
    ])

    if (!proposal) {
      log.warn({ proposalId }, 'drive_backup_proposal_not_found')
      return
    }

    const clientName =
      (proposal as unknown as { clients?: { name?: string } }).clients?.name ??
      (proposal as unknown as { leads?: { company?: string; name?: string } }).leads?.company ??
      (proposal as unknown as { leads?: { name?: string } }).leads?.name ??
      'Sin-Cliente'

    const clientFolderId = await findOrCreateClientFolder({
      subject: sub,
      parentFolderId: rootFolderId,
      clientName,
    })
    const proposalNumber = (proposal.number as string | null) ?? proposalId.slice(0, 8)
    const jsonName = `propuesta-${proposalNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.json`

    const snapshot = { proposal, items: items ?? [], backedUpAt: new Date().toISOString() }
    await uploadBackupSafe({
      subject: sub,
      name: jsonName,
      mimeType: 'application/json',
      data: Buffer.from(JSON.stringify(snapshot, null, 2)),
      folderId: clientFolderId,
    })
  } catch (err) {
    log.error({ err, proposalId }, 'drive_backup_proposal_failed')
  }
}
