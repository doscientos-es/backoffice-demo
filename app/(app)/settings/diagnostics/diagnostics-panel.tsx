'use client'

import {
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle2,
  LoaderCircle as Loader2,
  Play,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useFormFeedback } from '@/components/ui/form-feedback'
import { useBrowserNotifications } from '@/lib/hooks/use-browser-notifications'
import { useWebPush } from '@/lib/hooks/use-web-push'
import { cn } from '@/lib/utils'

import {
  type TestResult,
  testAI,
  testResendEmail,
  testSupabaseConnection,
  testVerifactuAeatSuite,
  testWebPush,
} from './actions'

export type DiagnosticsConfig = {
  ai: boolean
  verifactuGate: {
    status: 'missing' | 'failed' | 'passed'
    ranAt: string | null
  }
}

type Test = {
  title: string
  description: string
  run: () => Promise<TestResult>
  disabled?: boolean
  disabledHint?: string
  onSuccess?: () => void
}

function TestRow({ test }: { test: Test }) {
  const fb = useFormFeedback({ successResetMs: 0 })
  const { state } = fb

  async function onClick() {
    fb.setPending()
    try {
      const r = await test.run()
      if (r.ok) {
        fb.setSuccess(r.detail)
        test.onSuccess?.()
      } else fb.setError(r.error)
    } catch (e) {
      fb.setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }

  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{test.title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {test.disabled ? (test.disabledHint ?? 'No configurado') : test.description}
        </p>
        {state.status === 'success' || state.status === 'error' ? (
          <p
            className={cn(
              'mt-1.5 inline-flex items-start gap-1.5 text-xs',
              state.status === 'success' ? 'text-success' : 'text-destructive',
            )}
          >
            {state.status === 'success' ? (
              <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
            )}
            <span className="break-words">
              {state.status === 'success' ? state.message : state.message}
            </span>
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onClick}
        disabled={test.disabled || state.status === 'pending'}
        aria-busy={state.status === 'pending' || undefined}
        className="shrink-0"
      >
        {state.status === 'pending' ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Play className="size-3.5" aria-hidden />
        )}
        {state.status === 'pending' ? 'Probando…' : 'Probar'}
      </Button>
    </div>
  )
}

export function DiagnosticsPanel({ config }: { config: DiagnosticsConfig }) {
  const router = useRouter()
  const { permission, requestPermission } = useBrowserNotifications()
  const { subscribe } = useWebPush()

  async function runPushTest(): Promise<TestResult> {
    const result = permission === 'default' ? await requestPermission() : permission
    if (result !== 'granted') return { ok: false, error: 'Permiso de notificaciones no concedido.' }
    const subscribed = await subscribe()
    if (!subscribed) return { ok: false, error: 'No se pudo registrar este dispositivo para Push.' }
    return testWebPush()
  }

  const tests: Test[] = [
    {
      title: 'Email (Resend)',
      description: 'Envía un email de prueba a tu propia dirección.',
      run: testResendEmail,
    },
    {
      title: 'Conexión Supabase',
      description: 'Ejecuta una consulta ligera contra la base de datos.',
      run: testSupabaseConnection,
    },
    {
      title: 'Push móvil',
      description:
        'Simula un nuevo lead con acciones directas para llamar y registrar el resultado.',
      run: runPushTest,
    },
    {
      title: 'IA (Gemini / OpenAI)',
      description: 'Envía un prompt mínimo para comprobar la respuesta.',
      run: testAI,
      disabled: !config.ai,
      disabledHint: 'IA no configurada',
    },
    {
      title: 'VERI*FACTU · suite sintética',
      description:
        config.verifactuGate.status === 'passed'
          ? 'Última suite superada. Es una comprobación informativa y no afecta a la emisión.'
          : 'Genera XML/XSD, huella y QR, y envía un registro sintético a la AEAT de pruebas. No crea una factura operativa.',
      run: testVerifactuAeatSuite,
      onSuccess: router.refresh,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pruebas de sistemas</CardTitle>
        <CardDescription>
          Cada prueba usa datos de ejemplo y no afecta a datos reales.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-border divide-y pt-0">
        {tests.map((test) => (
          <TestRow key={test.title} test={test} />
        ))}
      </CardContent>
    </Card>
  )
}
