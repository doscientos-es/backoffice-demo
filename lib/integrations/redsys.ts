import { createCipheriv, createHmac } from 'node:crypto'

import { serverEnv } from '@/lib/env'

/**
 * Redsys / Paygold (BBVA) integration helper.
 *
 * Implements the SHA-256 HMAC signature algorithm required by Redsys.
 * @see https://pagosonline.redsys.es/parametros-entrada-salida.html
 */

export type RedsysParams = {
  Ds_Merchant_Amount: string // Centavos (ej. "100" para 1.00 EUR)
  Ds_Merchant_Order: string // Alphanumeric, 4-12 chars (ej. "202406250001")
  Ds_Merchant_MerchantCode: string // FUC
  Ds_Merchant_Terminal: string
  Ds_Merchant_Currency: string // 978 para EUR
  Ds_Merchant_TransactionType: string // "0" para Pago Simple
  Ds_Merchant_MerchantURL: string // Webhook (Notificación Online)
  Ds_Merchant_UrlOK: string // Redirect on success
  Ds_Merchant_UrlKO: string // Redirect on failure
  Ds_Merchant_PayMethods?: string // "T" (tarjeta), "z" (bizum), etc.
  Ds_Merchant_MerchantData?: string // Optional metadata returned in webhook
}

const REDSYS_URLS = {
  test: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  prod: 'https://sis.redsys.es/sis/realizarPago',
}

export function getRedsysUrl(): string {
  const env = serverEnv()
  return REDSYS_URLS[env.REDSYS_ENVIRONMENT]
}

/**
 * Derives the per-order signing key, as required by the HMAC_SHA256_V1 scheme:
 * 3DES (des-ede3-cbc, zero IV, no padding) of the order number, using the
 * base64-decoded merchant secret as the 24-byte key. The order is zero-padded
 * to a multiple of the 8-byte DES block before encryption.
 */
function deriveOrderKey(order: string): Buffer {
  const env = serverEnv()
  const decodedKey = Buffer.from(env.REDSYS_SECRET_KEY, 'base64')
  const iv = Buffer.alloc(8, 0)
  const cipher = createCipheriv('des-ede3-cbc', decodedKey, iv)
  cipher.setAutoPadding(false)

  const orderBuf = Buffer.from(order, 'utf8')
  const remainder = orderBuf.length % 8
  const padded =
    remainder === 0 ? orderBuf : Buffer.concat([orderBuf, Buffer.alloc(8 - remainder, 0)])

  return Buffer.concat([cipher.update(padded), cipher.final()])
}

/**
 * Generates the parameters and signature for a Redsys form.
 */
export function createRedsysPayment(params: RedsysParams) {
  // Redsys expects both values in URL-safe Base64. Standard Base64 is not
  // safe in an application/x-www-form-urlencoded POST: `+` can be decoded as
  // a space, and Redsys explicitly rejects `+`, `/` and `=` in the payload.
  const toBase64Url = (value: Buffer | string) =>
    (Buffer.isBuffer(value) ? value : Buffer.from(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')

  const merchantParameters = toBase64Url(JSON.stringify(params))

  // HMAC_SHA256_V1: derive a per-order key with 3DES, then HMAC the params.
  const derivedKey = deriveOrderKey(params.Ds_Merchant_Order)
  const signature = toBase64Url(
    createHmac('sha256', derivedKey).update(merchantParameters).digest(),
  )

  return {
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: signature,
  }
}

/**
 * Validates a Redsys notification signature.
 */
export function verifyRedsysSignature(merchantParameters: string, signature: string): boolean {
  const params = JSON.parse(Buffer.from(merchantParameters, 'base64').toString('utf-8'))
  const order = params.Ds_Order || params.Ds_Merchant_Order

  if (!order) return false

  const derivedKey = deriveOrderKey(order)
  const expected = createHmac('sha256', derivedKey).update(merchantParameters).digest()

  // Redsys sends URL-safe base64 in notifications; normalize both before comparing.
  const normalize = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return normalize(expected.toString('base64')) === normalize(signature)
}

export function parseRedsysResponse(merchantParameters: string) {
  const raw = Buffer.from(merchantParameters, 'base64').toString('utf-8')
  return JSON.parse(raw)
}

/**
 * DS_Response 0000 a 0099 indicate success.
 */
export function isRedsysSuccess(responseCode: string | number): boolean {
  const code = Number(responseCode)
  return code >= 0 && code <= 99
}
