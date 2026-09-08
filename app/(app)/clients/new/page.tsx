import type { Metadata } from 'next'
import Link from 'next/link'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { requireUser } from '@/lib/auth'

import { createClient } from '../actions'
import { ClientFormFields } from '../client-form-fields'

export const metadata: Metadata = { title: 'Nuevo cliente · doscientos' }

export default async function NewClientPage() {
  await requireUser()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo cliente"
        description="Registra un nuevo cliente."
        back={<BackLink href="/clients" label="Volver a clientes" />}
      />
      <Card className="mx-auto w-full max-w-3xl">
        <CardContent className="pt-6">
          <form action={createClient} className="flex flex-col gap-5">
            <ClientFormFields idPrefix="new" autoFocusName />
            <div className="border-border bg-card/95 sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:p-0 sm:pt-4 sm:backdrop-blur-none">
              <Button asChild variant="ghost" size="sm" className="min-h-11 w-full sm:w-auto">
                <Link href="/clients">Cancelar</Link>
              </Button>
              <SubmitButton className="min-h-11 w-full sm:w-auto" pendingLabel="Creando…">
                Crear cliente
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
