import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { requireUser } from '@/lib/auth'
import { getLeadForConvert } from '@/lib/leads/queries'

import { convertLeadToClientForm } from '../../actions'

export const metadata: Metadata = { title: 'Convertir lead · doscientos' }

export default async function ConvertLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireUser()

  const result = await getLeadForConvert(id)
  if (!result) notFound()
  const { lead, existingClientId } = result
  if (existingClientId) redirect(`/clients/${existingClientId}`)

  const defaultName = lead.company || lead.name
  const defaultAlias = lead.company ? '' : (lead.alias ?? '')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Convertir lead a cliente"
        description="Añade los datos fiscales para poder facturarle. El lead pasará a estado «Ganado»."
        back={<BackLink href={`/leads/${id}`} label="Volver al lead" />}
      />

      <Card>
        <CardContent className="pt-6">
          <form action={convertLeadToClientForm} className="flex flex-col gap-5">
            <input type="hidden" name="leadId" value={id} />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormRow
                label="Razón social"
                htmlFor="name"
                required
                hint="Nombre fiscal de la empresa o autónomo."
              >
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={defaultName}
                  autoFocus
                />
              </FormRow>
              <FormRow
                label="Alias / Label"
                htmlFor="alias"
                hint="Nombre corto para listas. Si está vacío se usa la razón social."
              >
                <Input id="alias" name="alias" maxLength={100} defaultValue={defaultAlias} />
              </FormRow>
              <FormRow label="NIF / CIF" htmlFor="nif" required>
                <Input id="nif" name="nif" required maxLength={20} placeholder="B12345678" />
              </FormRow>
              <FormRow
                label="Dirección de facturación"
                htmlFor="billing_address"
                required
                className="sm:col-span-2"
              >
                <Textarea
                  id="billing_address"
                  name="billing_address"
                  rows={2}
                  required
                  maxLength={400}
                  placeholder="Calle, número, CP, ciudad"
                />
              </FormRow>
              <FormRow label="Persona de contacto" htmlFor="contact_person">
                <Input
                  id="contact_person"
                  name="contact_person"
                  maxLength={160}
                  defaultValue={lead.name ?? ''}
                />
              </FormRow>
              <FormRow label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  maxLength={160}
                  defaultValue={lead.email ?? ''}
                />
              </FormRow>
              <FormRow label="Teléfono" htmlFor="phone" className="sm:col-span-2">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={40}
                  defaultValue={lead.phone ?? ''}
                />
              </FormRow>
            </div>

            <FormRow label="Notas internas" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={4000}
                defaultValue={lead.notes ?? ''}
              />
            </FormRow>

            <div className="border-border flex items-center justify-end gap-2 border-t pt-5">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/leads/${id}`}>Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Convirtiendo…">Convertir a cliente</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
