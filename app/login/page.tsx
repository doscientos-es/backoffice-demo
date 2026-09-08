import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthShell } from '@/components/auth/auth-shell'

import { LoginForm, LoginFormSkeleton } from './login-form'

export const metadata: Metadata = { title: 'Entrar · doscientos backoffice' }

export default function LoginPage() {
  return (
    <AuthShell
      title="Bienvenido"
      description="Accede al backoffice de doscientos."
      footer={<>Backoffice interno · Acceso restringido al equipo.</>}
    >
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
