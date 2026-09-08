import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * AES-256-GCM symmetric encryption for vault secrets.
 *
 * The demo uses a deterministic local key because its fixtures contain no real secrets.
 *
 * Ciphertext format (all hex, colon-separated): `iv:authTag:ciphertext`
 */

const ALGORITHM = 'aes-256-gcm' as const
const IV_BYTES = 16

const DEMO_ENCRYPTION_KEY = scryptSync('doscientos-demo-vault', 'vault-key-salt-v1', 32) as Buffer

/**
 * Returns the fixed local demo key.
 */
function getDecryptionKeys(): Buffer[] {
  return [DEMO_ENCRYPTION_KEY]
}

function decryptWithKey(ciphertext: Buffer, iv: Buffer, authTag: Buffer, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Encrypts a plaintext string. Returns `iv:authTag:ciphertext` (hex). */
export function encryptSecret(plaintext: string): string {
  const [key] = getDecryptionKeys()
  if (!key) throw new Error('No encryption key available')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/** Decrypts a ciphertext produced by `encryptSecret`. */
export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivHex, authTagHex, encHex] = parts as [string, string, string]
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')

  for (const key of getDecryptionKeys()) {
    try {
      return decryptWithKey(encrypted, iv, authTag, key)
    } catch {
      // Try the legacy key when the ciphertext predates VAULT_ENCRYPTION_KEY.
    }
  }

  throw new Error(
    'No se pudo descifrar el secreto: puede estar dañado o haberse cifrado con una clave no disponible.',
  )
}
