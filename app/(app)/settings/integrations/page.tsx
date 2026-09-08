import { redirect } from 'next/navigation'

export const metadata = { title: 'Correo · Ajustes · doscientos' }

export default function IntegrationsSettingsPage() {
  redirect('/settings/email')
}
