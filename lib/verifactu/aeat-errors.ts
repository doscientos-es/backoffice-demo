export const AEAT_VERIFACTU_ERROR_CATALOG_URL = '#demo-fiscal'

export type AeatErrorEffect = 'retryable' | 'terminal' | 'review'
export type AeatErrorMetadata = { code: string; effect: AeatErrorEffect; effectLabel: string }

export function extractAeatErrorCode(value: string | null | undefined): string | null {
  return value?.match(/\b([0-9]{4})\b/)?.[1] ?? null
}

export function getAeatErrorMetadata(
  code: string | null | undefined,
  message?: string | null,
): AeatErrorMetadata | null {
  const resolved = code ?? extractAeatErrorCode(message)
  return resolved ? { code: resolved, effect: 'review', effectLabel: 'Estado simulado: revisa los datos de la demo.' } : null
}