'use client'

import { TriangleAlert as AlertTriangle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Component, type ErrorInfo, type ReactNode, Suspense } from 'react'

import { Button } from './button'

interface Props {
  children: ReactNode
  /** Fallback inline pequeño para drawers/dialogs. Si no se pasa se usa el default. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * ErrorBoundary de cliente para proteger drawers, dialogs y otras piezas
 * interactivas. Evita que un error en el contenido crashee toda la página.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <MiComponenteQuePodriaFallar />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción aquí podría ir un servicio de logging (Sentry, etc.)
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    const { children, fallback } = this.props

    if (error) {
      if (fallback) return fallback(error, this.reset)
      return <DefaultFallback error={error} reset={this.reset} />
    }

    return children
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-xl">
        <AlertTriangle className="text-destructive size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Algo ha salido mal</p>
        <p className="text-muted-foreground text-xs">No se ha podido cargar este contenido.</p>
        {true && (
          <p className="text-muted-foreground/60 mt-1 max-w-xs truncate text-[11px]">
            {error.message}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={reset}>
        <RefreshCw className="size-3.5" />
        Reintentar
      </Button>
    </div>
  )
}

/**
 * Aísla una sección de página (típicamente un Server Component con su propio
 * fetch) combinando ErrorBoundary + Suspense. Si la sección falla, solo cae
 * esa pieza y el resto de la página sigue funcionando.
 *
 * Uso:
 *   <SectionBoundary pending={<MiSkeleton />}>
 *     <WidgetQueHaceFetch />
 *   </SectionBoundary>
 */
export function SectionBoundary({
  children,
  pending,
  label,
}: {
  children: ReactNode
  /** Skeleton mostrado mientras la sección carga. */
  pending?: ReactNode
  /** Texto del fallback de error. Por defecto "No se pudo cargar esta sección". */
  label?: string
}) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <SectionErrorCard error={error} reset={reset} label={label} />}
    >
      <Suspense fallback={pending}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function SectionErrorCard({
  error,
  reset,
  label,
}: {
  error: Error
  reset: () => void
  label?: string
}) {
  const router = useRouter()
  return (
    <div className="bg-card ring-foreground/10 flex flex-col items-center justify-center gap-3 rounded-xl p-6 text-center ring-1">
      <div className="bg-destructive/10 flex size-10 items-center justify-center rounded-lg">
        <AlertTriangle className="text-destructive size-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{label ?? 'No se pudo cargar esta sección'}</p>
        {true && (
          <p className="text-muted-foreground/60 max-w-xs truncate text-[11px]">{error.message}</p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          router.refresh()
          reset()
        }}
      >
        <RefreshCw className="size-3.5" />
        Reintentar
      </Button>
    </div>
  )
}
