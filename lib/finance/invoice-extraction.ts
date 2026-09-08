import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIObject } from '@/lib/ai'
import { extractPdfPages } from '@/lib/internal-documents/pdf-text'

const InvoiceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .default(null)

export const ExpenseInvoiceSuggestionSchema = z.object({
  vendor: z.string().max(160).nullable().default(null),
  description: z.string().max(400).nullable().default(null),
  expense_date: InvoiceDate,
  due_date: InvoiceDate,
  subtotal: z.number().min(0).nullable().default(null),
  tax_rate: z.number().min(0).max(100).nullable().default(null),
  vendor_nif: z.string().max(20).nullable().default(null),
  invoice_reference: z.string().max(80).nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
})

export type ExpenseInvoiceSuggestion = z.infer<typeof ExpenseInvoiceSuggestionSchema>
export type ExpenseInvoiceExtraction = {
  suggestion: ExpenseInvoiceSuggestion
  source: 'ai' | 'rules'
  warning: string | null
}

const SYSTEM_PROMPT = `Extrae datos de una factura recibida española para crear un gasto.
Devuelve solo datos que aparezcan inequívocamente en el texto. Las fechas deben usar YYYY-MM-DD.
subtotal es la base imponible y tax_rate el único porcentaje de IVA aplicable. Si hay varios tipos de IVA,
retenciones o no puedes determinar un valor, devuelve null para subtotal y tax_rate. No infieras proveedor,
fechas, importes o NIF. No marques una factura como pagada.`

function toNumber(value: string): number | null {
  const compact = value.replace(/[^0-9,.-]/g, '')
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function findAmount(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label}\\s*[:=]?\\s*([0-9.]+,[0-9]{2}|[0-9]+(?:\\.[0-9]{2})?)`, 'i'),
    )
    if (match?.[1]) return toNumber(match[1])
  }
  return null
}

function findDate(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label}\\s*[:=]?\\s*(\\d{1,2})[/-](\\d{1,2})[/-](\\d{4})`, 'i'),
    )
    if (!match) continue
    const [, day, month, year] = match
    if (!day || !month || !year) continue
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
}

/** Free, best-effort extraction for a digital invoice when AI is unavailable. */
export function extractExpenseInvoiceWithRules(text: string): ExpenseInvoiceSuggestion {
  const invoiceNumber =
    text.match(
      /(?:n[ºo°.]?\s*(?:de\s*)?factura|factura\s*(?:n[ºo°.]?)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{2,79})/i,
    )?.[1] ?? null
  const nif = text.match(/\b(?:[A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])\b/i)?.[0]?.toUpperCase() ?? null
  const taxRate = text.match(/(?:IVA|I\.V\.A\.)\s*(\d{1,2}(?:[,.]\d{1,2})?)\s*%/i)?.[1]

  return {
    vendor: null,
    description: null,
    expense_date: findDate(text, [
      String.raw`fecha(?:\s+de)?\s+factura`,
      String.raw`fecha\s+emisi[oó]n`,
      'fecha',
    ]),
    due_date: findDate(text, ['vencimiento', String.raw`fecha\s+de\s+pago`]),
    subtotal: findAmount(text, [String.raw`base\s+imponible`, 'subtotal', 'base']),
    tax_rate: taxRate ? toNumber(taxRate) : null,
    vendor_nif: nif,
    invoice_reference: invoiceNumber,
    confidence: 0.35,
  }
}

function mergeSuggestion(
  rules: ExpenseInvoiceSuggestion,
  ai: ExpenseInvoiceSuggestion,
): ExpenseInvoiceSuggestion {
  return {
    vendor: ai.vendor ?? rules.vendor,
    description: ai.description ?? rules.description,
    expense_date: ai.expense_date ?? rules.expense_date,
    due_date: ai.due_date ?? rules.due_date,
    subtotal: ai.subtotal ?? rules.subtotal,
    tax_rate: ai.tax_rate ?? rules.tax_rate,
    vendor_nif: ai.vendor_nif ?? rules.vendor_nif,
    invoice_reference: ai.invoice_reference ?? rules.invoice_reference,
    confidence: ai.confidence,
  }
}

export async function extractExpenseInvoice(bytes: ArrayBuffer): Promise<ExpenseInvoiceExtraction> {
  const extracted = await extractPdfPages(bytes)
  const text = extracted.pages
    .map((page) => page.content)
    .join('\n')
    .slice(0, 50_000)
  if (!text) {
    return {
      suggestion: ExpenseInvoiceSuggestionSchema.parse({}),
      source: 'rules',
      warning:
        'El PDF no contiene texto seleccionable. Podrás usar OCR cuando se añada un proveedor.',
    }
  }

  const rules = extractExpenseInvoiceWithRules(text)
  if (!isAIEnabled()) {
    return {
      suggestion: rules,
      source: 'rules',
      warning: 'La IA no está configurada; revisa los datos extraídos antes de aplicarlos.',
    }
  }

  try {
    const ai = await runAIObject({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: `Texto de la factura:\n${text}`,
      schema: ExpenseInvoiceSuggestionSchema,
      temperature: 0,
      maxOutputTokens: 600,
    })

    return {
      suggestion: mergeSuggestion(rules, ai),
      source: 'ai',
      warning: extracted.truncated
        ? 'El texto del PDF estaba truncado; revisa todos los datos.'
        : null,
    }
  } catch {
    return {
      suggestion: rules,
      source: 'rules',
      warning: 'La IA no está disponible; revisa los datos extraídos antes de aplicarlos.',
    }
  }
}
