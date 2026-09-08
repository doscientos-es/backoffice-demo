'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ReactNode, useEffect } from 'react'

// next-themes injects an inline <script> (to prevent theme FOUC) via
// React.createElement("script"). React 19 warns about any <script> tag
// rendered inside a component tree — but the script already ran before
// hydration, so the warning is a false positive.
function useSuppressNextThemesScriptWarning() {
  useEffect(() => {
    const original = console.error.bind(console)
    console.error = (...args: Parameters<typeof console.error>) => {
      if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) return
      original(...args)
    }
    return () => {
      console.error = original
    }
  }, [])
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useSuppressNextThemesScriptWarning()
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
