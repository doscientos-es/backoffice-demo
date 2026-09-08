import type { Metadata } from 'next'
import Link from 'next/link'

import { Logo } from '@/components/branding'

export const metadata: Metadata = {
  title: 'Bienvenido · doscientos',
  robots: { index: false, follow: false },
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
          <Link href="/inicio" aria-label="doscientos">
            <Logo size="md" />
          </Link>
          <span className="text-muted-foreground text-xs">Configura tu cuenta</span>
        </div>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
