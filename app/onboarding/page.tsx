import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'

import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const user = await requireUser({ allowUnonboarded: true })
  if (user.onboardedAt) redirect('/inicio')

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl leading-tight">Bienvenido a doscientos</h1>
        <p className="text-muted-foreground max-w- text-sm text-pretty">
          Vamos a configurar tu perfil. Solo te pediremos lo imprescindible; puedes ampliarlo
          después desde Ajustes.
        </p>
      </header>

      <OnboardingForm
        defaultName={user.name}
        email={user.email}
        defaultAvatarUrl={user.avatarUrl}
        defaultGithubHandle={user.githubHandle}
        defaultEmailAlias={user.emailAlias}
        defaultPhone={user.phone}
      />
    </div>
  )
}
