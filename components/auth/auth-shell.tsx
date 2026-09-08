import Link from 'next/link'
import type { ReactNode } from 'react'

import { Logo } from '@/components/branding'

export type AuthShellProps = {
  title: string
  description?: string
  footer?: ReactNode
  children: ReactNode
}

export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Base background */}
      <div className="bg-background absolute inset-0" />

      {/* Animated mesh gradient — large blurred blobs morphing across the viewport */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute rounded-full"
          style={{
            top: '-20%',
            left: '-15%',
            width: '60vw',
            height: '60vw',
            background: 'radial-gradient(circle, #2a4227 0%, transparent 70%)',
            opacity: 0.55,
            filter: 'blur(60px)',
            animation: 'auth-blob-1 18s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: '-25%',
            right: '-15%',
            width: '55vw',
            height: '55vw',
            background: 'radial-gradient(circle, #3d6b38 0%, transparent 70%)',
            opacity: 0.5,
            filter: 'blur(70px)',
            animation: 'auth-blob-2 22s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: '25%',
            right: '5%',
            width: '45vw',
            height: '45vw',
            background: 'radial-gradient(circle, #5a8a52 0%, transparent 70%)',
            opacity: 0.4,
            filter: 'blur(80px)',
            animation: 'auth-blob-3 26s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: '5%',
            left: '15%',
            width: '40vw',
            height: '40vw',
            background: 'radial-gradient(circle, #2a4227 0%, transparent 70%)',
            opacity: 0.35,
            filter: 'blur(90px)',
            animation: 'auth-blob-4 30s ease-in-out infinite',
          }}
        />
      </div>

      {/* Subtle grain overlay for texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        aria-hidden
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Content sits above blobs via DOM order */}
      <div className="relative w-full max-w-sm">
        <Link href="/" aria-label="doscientos" className="mb-8 flex items-center justify-center">
          <Logo size="lg" />
        </Link>
        <div className="mb-6 text-center">
          <h1 className="text-primary text-xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>
          ) : null}
        </div>
        {children}
        {footer ? <p className="text-muted-foreground mt-6 text-center text-xs">{footer}</p> : null}
      </div>
    </main>
  )
}
