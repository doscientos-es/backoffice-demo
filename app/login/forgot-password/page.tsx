import { AuthShell } from '@/components/auth/auth-shell'

import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Recuperar contraseña · doscientos' }

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar contraseña"
      description="Te enviaremos un enlace para crear una nueva contraseña."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
