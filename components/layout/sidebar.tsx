'use client'

import { Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Logo } from '@/components/branding'
import { CommandPaletteTrigger } from '@/components/layout/command-palette-trigger'
import { NavigationTree } from '@/components/layout/navigation-tree'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { UserMenu } from '@/components/layout/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { IconButton } from '@/components/ui/icon-button'
import type { CurrentUser } from '@/lib/auth'
import { visibleNavigationGroups } from '@/lib/navigation/navigation'

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname()

  const visibleGroups = visibleNavigationGroups(user.role)

  return (
    <aside className="app-sidebar border-border bg-card h-full w-56 shrink-0 flex-col border-r">
      <div className="px-4 py-5">
        <Link
          href="/inicio"
          aria-label="doscientos · Inicio"
          className="focus-visible:ring-ring focus-visible:ring-offset-card inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Logo size="md" />
        </Link>
      </div>
      <div className="px-2 pb-2">
        <CommandPaletteTrigger />
      </div>
      <nav
        className="scroll-fade no-scrollbar flex flex-1 flex-col overflow-y-auto px-2 py-1"
        aria-label="Navegación principal"
      >
        <NavigationTree groups={visibleGroups} pathname={pathname} />
      </nav>

      <footer className="border-border flex flex-col gap-2 border-t p-2">
        <ErrorBoundary>
          <div className="flex items-center justify-between gap-1">
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <NotificationsBell memberId={user.id} />
              <IconButton
                asChild
                variant="ghost"
                className="border-0"
                label="Ajustes"
                aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
              >
                <Link href="/settings">
                  <Settings className="size-4" aria-hidden />
                </Link>
              </IconButton>
              <UserMenu user={user} />
            </div>
          </div>
        </ErrorBoundary>
      </footer>
    </aside>
  )
}
