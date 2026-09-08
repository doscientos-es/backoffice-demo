import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePageRole } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import { listEmailTemplates } from '../email-templates/actions'
import { EmailTemplatesManager } from '../email-templates/email-templates-manager'
import { GmailSyncForm } from '../integrations/gmail-sync-form'

export const metadata: Metadata = { title: 'Correo · Ajustes · doscientos' }
export const dynamic = 'force-dynamic'

export default async function EmailSettingsPage() {
  await requirePageRole(['owner', 'admin'])
  const supabase = await createServerClient()
  const [{ data: settings }, templates] = await Promise.all([
    supabase.from('settings').select('gmail_sync_mailboxes').eq('id', 1).maybeSingle(),
    listEmailTemplates(),
  ])
  const mailboxes = Array.isArray(settings?.gmail_sync_mailboxes)
    ? settings.gmail_sync_mailboxes.filter((email: unknown): email is string => typeof email === 'string')
    : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Correo"
        description="Configura los buzones de sincronización y las plantillas reutilizables para leads."
      />

      <Card>
        <CardHeader>
          <CardTitle>Sincronización Gmail de leads</CardTitle>
          <CardDescription>
            Al sincronizar un lead se consultan los buzones de los miembros activos y estos buzones
            generales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GmailSyncForm mailboxes={mailboxes} />
        </CardContent>
      </Card>

      <section aria-labelledby="email-templates-title" className="flex flex-col gap-4">
        <div>
          <h2 id="email-templates-title" className="text-base font-semibold">
            Plantillas de email
          </h2>
          <p className="text-muted-foreground text-sm">
            Gestiona las plantillas reutilizables para enviar emails desde el CRM.
          </p>
        </div>
        <EmailTemplatesManager templates={templates} />
      </section>
    </div>
  )
}
