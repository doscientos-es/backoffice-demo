/**
 * Muestra un aviso cuando la IA no está configurada.
 * Úsalo en cualquier sección o página que requiera OPENAI_API_KEY.
 *
 * Uso:
 *   import { AiNotice } from "./ai-notice"
 *   if (!isAIEnabled()) return <AiNotice />
 */
import { Sparkle as Sparkles } from 'lucide-react'

interface AiNoticeProps {
  /** Mensaje personalizado. Por defecto explica que la IA no está activada. */
  message?: string
  /** Compacto: solo icono + texto inline. Por defecto muestra un bloque */
  inline?: boolean
}

export function AiNotice({
  message = 'La asistencia de IA no está disponible. Para activarla, establece AI_PROVIDER en las variables de entorno.',
  inline = false,
}: AiNoticeProps) {
  if (inline) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <Sparkles className="h-3.5 w-3.5 opacity-50" />
        IA no configurada
      </span>
    )
  }

  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Sparkles className="h-8 w-8 opacity-30" />
      <p className="max-w-sm text-sm">{message}</p>
    </div>
  )
}
