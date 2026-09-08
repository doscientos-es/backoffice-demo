'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 text-center font-sans dark:bg-zinc-950">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-8 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <title>Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Error inesperado
          </h1>
          <p className="max-w-sm text-sm text-zinc-500">
            Ha ocurrido un error crítico en la aplicación. Por favor, recarga la página.
          </p>
          {error.digest && <p className="text-xs text-zinc-400">ID: {error.digest}</p>}
        </div>
        <button
          onClick={reset}
          type="button"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Reintentar
        </button>
      </body>
    </html>
  )
}
