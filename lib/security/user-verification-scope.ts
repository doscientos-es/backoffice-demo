/**
 * Stable scopes for one-time WebAuthn step-up authorization. Keep this module
 * client-safe: UI code needs the same types to request a verification.
 */
export const USER_VERIFICATION_INTENTS = [
  'vault.unlock',
  'invoice.status.update',
  'invoice.payment.revert',
  'invoice.send_aeat',
  'invoice.verifactu_regularize',
  'team.member.role.update',
  'team.member.deactivate',
  'team.member.delete',
  'backup.delete',
  'web.db_credentials.update',
] as const

export type UserVerificationIntent = (typeof USER_VERIFICATION_INTENTS)[number]

export type UserVerificationScope = {
  intent: UserVerificationIntent
  resource: string
}

/** Creates an explicit scope so authorization cannot cross action boundaries. */
export function userVerificationScope(
  intent: UserVerificationIntent,
  resource: string,
): UserVerificationScope {
  return { intent, resource }
}
