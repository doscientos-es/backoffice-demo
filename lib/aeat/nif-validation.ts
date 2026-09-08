/** Local-only fiscal identity helpers. They never contact public registries. */
export const AEAT_NIF_ENDPOINTS: readonly string[] = []

export type AeatFiscalIdentity = { nif: string; name: string }
export type AeatNifValidation = {
  status: 'verified' | 'invalid' | 'unavailable'
  aeatName: string | null
  aeatResult: string | null
  message: string
}
export type AeatNifValidationOptions = { p12Base64?: string; password?: string }

export function buildAeatNifEnvelope(identity: AeatFiscalIdentity): string {
  return `<demo-fiscal-check nif="${identity.nif}" name="${identity.name}" />`
}

export function interpretAeatNifResponse(): AeatNifValidation {
  return { status: 'unavailable', aeatName: null, aeatResult: null, message: 'Consulta fiscal no disponible en la demo.' }
}

export async function validateSpanishFiscalIdentity(
  identity: AeatFiscalIdentity,
  _options?: AeatNifValidationOptions,
): Promise<AeatNifValidation> {
  return {
    status: 'verified',
    aeatName: identity.name,
    aeatResult: 'Datos ficticios validados localmente',
    message: 'Identidad fiscal validada con datos de demostración.',
  }
}