'use server'

import { AI_MODELS, isAIEnabled, runAIChat } from '@/lib/ai'
import { requireRole } from '@/lib/auth'
import { sendEmail } from '@/lib/email/resend'
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { sendWebPushToMembers } from '@/lib/push/web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { runVerifactuAeatTestDiagnostic } from '@/lib/verifactu/diagnostics'

export type TestResult = { ok: true; detail: string } | { ok: false; error: string }

const log = scopedLogger('diagnostics')
const ADMIN = ['owner', 'admin'] as const

function fail(error: string): TestResult {
  return { ok: false, error }
}

/** Sends a test email to the current admin via Resend. */
export async function testResendEmail(): Promise<TestResult> {
  const user = await requireRole([...ADMIN])
  try {
    const result = await sendEmail({
      fromName: 'doscientos',
      fromAlias: 'notificaciones',
      to: user.email,
      subject: 'Prueba de diagnóstico · doscientos',
      html: '<p>Este es un email de prueba enviado desde Ajustes → Diagnóstico.</p>',
      tags: { type: 'diagnostic' },
    })
    if (result.mocked) {
      return { ok: true, detail: 'Resend en modo mock (sin RESEND_API_KEY)' }
    }
    return { ok: true, detail: `Email enviado a ${user.email}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error al enviar'
    log.error({ err: e }, 'resend test failed')
    return fail(msg)
  }
}

/** Runs a lightweight query against Supabase using the admin client. */
export async function testSupabaseConnection(): Promise<TestResult> {
  await requireRole([...ADMIN])
  try {
    const supabase = createAdminClient()
    const started = Date.now()
    const { error, count } = await supabase
      .from('settings')
      .select('id', { count: 'exact', head: true })
    if (error) return fail(error.message)
    return { ok: true, detail: `Conexión OK · ${count ?? 0} fila(s) · ${Date.now() - started} ms` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error de conexión'
    log.error({ err: e }, 'supabase test failed')
    return fail(msg)
  }
}

/** Sends a real push to the device currently registered for this member. */
export async function testWebPush(): Promise<TestResult> {
  const user = await requireRole([...ADMIN])
  const env = serverEnv()
  if (!env.WEB_PUSH_VAPID_PUBLIC_KEY || !env.WEB_PUSH_VAPID_PRIVATE_KEY) {
    return fail('Web Push no configurado: faltan las claves VAPID en producción')
  }
  const { count } = await createAdminClient()
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
  if (!count)
    return fail(
      'Este dispositivo aún no está suscrito. Activa las notificaciones desde la campana.',
    )
  await sendWebPushToMembers([user.id], {
    title: '✅ Push de prueba',
    body: 'Este dispositivo recibirá avisos de leads y seguimientos. Toca para abrir el diagnóstico.',
    url: '/settings/diagnostics',
    tag: 'diagnostic-push',
    badge: 1,
    actions: [{ action: 'open', title: 'Abrir diagnóstico' }],
  })
  return { ok: true, detail: 'Push enviado a tus dispositivos registrados con acción para abrirlo' }
}

/** Pings the AI provider with a tiny prompt. */
export async function testAI(): Promise<TestResult> {
  await requireRole([...ADMIN])
  if (!isAIEnabled())
    return fail('IA no configurada (AI_PROVIDER no establecido o credenciales faltantes)')
  try {
    const out = await runAIChat({
      model: AI_MODELS.default,
      system: 'Responde con una sola palabra.',
      user: "Di 'ok'.",
      temperature: 0,
    })
    return { ok: true, detail: `IA respondió: ${out.slice(0, 40)}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error de IA'
    log.error({ err: e }, 'ai test failed')
    return fail(msg)
  }
}

/** Submits a synthetic record to AEAT pre-production without creating an operational invoice. */
export async function testVerifactuAeatSuite(): Promise<TestResult> {
  const user = await requireRole([...ADMIN])
  try {
    const result = await runVerifactuAeatTestDiagnostic(user.id)
    return result.ok ? { ok: true, detail: result.detail } : fail(result.detail)
  } catch (error) {
    log.error({ err: error }, 'verifactu diagnostic failed')
    return fail(
      'No se pudo completar la suite VERI*FACTU. La facturación real permanece bloqueada.',
    )
  }
}
