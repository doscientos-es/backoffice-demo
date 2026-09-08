import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const MAX_DOCUMENT_TEXT_LENGTH = 2_000_000
const MAX_PAGE_TEXT_LENGTH = 100_000

export type ExtractedPdfPage = { pageNumber: number; content: string }
export type ExtractedPdf = { pageCount: number; pages: ExtractedPdfPage[]; truncated: boolean }

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function textFromItem(item: unknown): string {
  if (!item || typeof item !== 'object' || !('str' in item)) return ''
  return typeof item.str === 'string' ? item.str : ''
}

/** Extract the embedded text layer of a digital PDF. It deliberately does not perform OCR. */
export async function extractPdfPages(bytes: ArrayBuffer): Promise<ExtractedPdf> {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: true,
  })

  try {
    const pdf = await loadingTask.promise
    const pages: ExtractedPdfPage[] = []
    let remaining = MAX_DOCUMENT_TEXT_LENGTH
    let truncated = false

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (remaining <= 0) {
        truncated = true
        break
      }

      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = normalizeText(content.items.map(textFromItem).join(' '))
      if (!text) continue

      const limit = Math.min(MAX_PAGE_TEXT_LENGTH, remaining)
      const pageText = text.slice(0, limit)
      if (pageText.length < text.length) truncated = true
      remaining -= pageText.length
      pages.push({ pageNumber, content: pageText })
    }

    return { pageCount: pdf.numPages, pages, truncated }
  } finally {
    await loadingTask.destroy()
  }
}
