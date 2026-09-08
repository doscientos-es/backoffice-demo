export const DIAGNOSTIC_PDF_BUCKET = 'documents'

/** Stable private Storage path for a diagnostic report. Access remains token-gated by the route. */
export function diagnosticPdfStoragePath(diagnosticId: string): string {
  return `diagnostics/${diagnosticId}/diagnostico-doscientos.pdf`
}

/** Copies Node Buffers and Uint8Arrays into the ArrayBuffer required by the storage provider. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}