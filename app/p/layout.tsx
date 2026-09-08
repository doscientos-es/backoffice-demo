import { ShieldCheck } from 'lucide-react'

import { LogoMark } from '@/components/branding'

export const metadata = {
  title: 'Portal · doscientos',
  robots: { index: false, follow: false },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f6f7f3] dark:bg-[#111410]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_15%_0%,rgba(189,255,123,0.14),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(42,66,39,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_15%_0%,rgba(189,255,123,0.08),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(189,255,123,0.05),transparent_30%)]"
      />

      <header className="relative border-b border-black/[0.06] bg-white/70 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111410]/80">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} variant="auto" />
            <div className="leading-none">
              <p className="text-sm font-bold tracking-tight">doscientos</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Área de cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-emerald-950/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-emerald-900 dark:border-emerald-200/10 dark:bg-emerald-200/[0.06] dark:text-emerald-200">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Acceso privado
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <footer className="relative border-t border-black/[0.06] bg-white/40 dark:border-white/[0.08] dark:bg-black/10">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-col items-center justify-between gap-1 px-4 py-3 text-center text-xs text-zinc-500 sm:flex-row sm:px-6 sm:text-left dark:text-zinc-400">
          <span>© {new Date().getFullYear()} doscientos</span>
          <span>Este enlace contiene información privada. No lo compartas.</span>
        </div>
      </footer>
    </div>
  )
}
