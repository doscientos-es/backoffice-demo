import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'

import { ProfileForm } from '../profile-form'

export const metadata = { title: 'Perfil · Ajustes · doscientos' }

export default async function ProfileSettingsPage() {
  const user = await requireUser()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Perfil"
        description="Datos personales, alias de remitente y firma auto-generada."
      />
      <Card>
        <CardContent className="pt-6">
          <ProfileForm
            name={user.name}
            email={user.email}
            avatarUrl={user.avatarUrl}
            emailAlias={user.emailAlias ?? null}
            githubHandle={user.githubHandle ?? null}
            jobTitle={user.jobTitle ?? null}
            phone={user.phone ?? null}
            contactEmail={user.contactEmail ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
