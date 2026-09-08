import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Toaster } from 'sileo'

import { LogoMark } from '@/components/branding'
import { ThemeProvider } from '@/components/theme-provider'
import { STARTUP_SPLASH_SESSION_KEY } from '@/lib/startup-splash'

import './globals.css'

export const metadata: Metadata = {
  title: 'doscientos · backoffice demo',
  description: 'Demo pública del backoffice de doscientos con datos ficticios.',
  robots: { index: true, follow: true },
  icons: {
    icon: [
      {
        url: '/brand/logo-light.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: light)',
      },
      { url: '/brand/logo.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/brand/logo.svg',
    apple: '/brand/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#2a4227' },
  ],
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className="font-sans">
      <body>
        <Script id="demo-network-guard" strategy="beforeInteractive">
          {`window.fetch = async () => new Response(JSON.stringify({ demo: true, data: [], items: [], summary: "Resultado generado localmente para la demostración.", suggested_next_step: "Revisar la siguiente oportunidad.", temperature: "warm", confidence: 82, tags: ["demo"] }), { status: 200, headers: { "Content-Type": "application/json", "X-Doscientos-Demo": "local" } });`}
        </Script>
        <Script id="startup-splash-state" strategy="beforeInteractive">
          {`try { if (sessionStorage.getItem("${STARTUP_SPLASH_SESSION_KEY}")) document.documentElement.dataset.startupSplashSeen = "true"; } catch {} window.setTimeout(() => document.getElementById("startup-splash")?.classList.add("is-hidden"), 1200);`}
        </Script>
        <div id="startup-splash" role="status" aria-label="Cargando Doscientos">
          <div className="startup-splash-mark-shell">
            <LogoMark size={112} variant="light" className="startup-splash-mark" />
          </div>
          <div className="startup-splash-copy">
            <strong>doscientos</strong>
            <span>BACKOFFICE</span>
            <small>Demo pública · datos ficticios</small>
          </div>
          <div className="startup-splash-progress" aria-hidden="true">
            <i />
          </div>
        </div>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
