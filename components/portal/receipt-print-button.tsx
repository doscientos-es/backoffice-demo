'use client'

import { Printer } from 'lucide-react'
import { useEffect } from 'react'

/**
 * Print control for the public payment receipt. Lives in a Client Component
 * because it needs `window.print()` and an event handler, which a Server
 * Component cannot hold. Also triggers an automatic print when the page is
 * opened with the `?print` query param.
 */
export function ReceiptPrintButton() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('print')) {
      window.print()
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
    >
      <Printer className="h-3.5 w-3.5" />
      Imprimir justificante
    </button>
  )
}
