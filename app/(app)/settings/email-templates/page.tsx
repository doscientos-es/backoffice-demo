import { redirect } from 'next/navigation'

export const metadata = { title: 'Correo · Ajustes · doscientos' }

export default function EmailTemplatesPage() {
  redirect('/settings/email')
}
