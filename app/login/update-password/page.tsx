import { AuthShell } from '@/components/auth/auth-shell'

import { UpdatePasswordForm } from './update-password-form'

export const metadata = { title: 'Nueva contraseña · doscientos' }

export default function UpdatePasswordPage() {
  return (
    <AuthShell title="Nueva contraseña" description="Define una contraseña para tu cuenta.">
      <UpdatePasswordForm />
    </AuthShell>
  )
}
