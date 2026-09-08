import { createAdminClient } from '@/lib/supabase/admin'

import { extractPdfPages } from './pdf-text'

const PDF_MIME_TYPE = 'application/pdf'
const INSERT_BATCH_SIZE = 100

type IndexInput = {
  documentId: string
  version: number
  mimeType: string | null
  bytes: ArrayBuffer
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'No se pudo extraer el contenido.'
  return message.slice(0, 500)
}

/**
 * Indexes only the native text layer of a PDF. Errors are persisted as status
 * information so an uploaded document remains available even when indexing fails.
 */
export async function indexInternalDocument(input: IndexInput): Promise<void> {
  const db = createAdminClient()
  const base = {
    document_id: input.documentId,
    source_version: input.version,
    updated_at: new Date().toISOString(),
  }

  try {
    if (input.mimeType !== PDF_MIME_TYPE) {
      await db.from('internal_document_extractions').upsert({
        ...base,
        status: 'unsupported',
        page_count: 0,
        truncated: false,
        extraction_error: null,
      })
      await db.from('internal_document_text_pages').delete().eq('document_id', input.documentId)
      return
    }

    await db.from('internal_document_extractions').upsert({
      ...base,
      status: 'processing',
      page_count: 0,
      truncated: false,
      extraction_error: null,
    })
    const extracted = await extractPdfPages(input.bytes)

    const { error: deleteError } = await db
      .from('internal_document_text_pages')
      .delete()
      .eq('document_id', input.documentId)
    if (deleteError) throw new Error(deleteError.message)

    for (let offset = 0; offset < extracted.pages.length; offset += INSERT_BATCH_SIZE) {
      const { error } = await db.from('internal_document_text_pages').insert(
        extracted.pages.slice(offset, offset + INSERT_BATCH_SIZE).map((page) => ({
          document_id: input.documentId,
          source_version: input.version,
          page_number: page.pageNumber,
          content: page.content,
        })),
      )
      if (error) throw new Error(error.message)
    }

    await db.from('internal_document_extractions').upsert({
      ...base,
      status: extracted.pages.length > 0 ? 'extracted' : 'no_text',
      page_count: extracted.pageCount,
      truncated: extracted.truncated,
      extraction_error: null,
      extracted_at: new Date().toISOString(),
    })
  } catch (error) {
    await db.from('internal_document_text_pages').delete().eq('document_id', input.documentId)
    await db.from('internal_document_extractions').upsert({
      ...base,
      status: 'failed',
      page_count: 0,
      truncated: false,
      extraction_error: errorMessage(error),
    })
  }
}
