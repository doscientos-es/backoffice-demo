/**
 * Cliente AI - capa de abstraccion sobre Vercel AI SDK.
 *
 * Proveedor controlado por AI_PROVIDER env var. Hoy solo está cableado Vertex;
 * la estructura de resolveModel() está preparada para reactivar otros
 * proveedores (gemini / openai / deepseek) añadiendo su branch en el futuro.
 *
 *  - "vertex": Google Vertex AI. Autenticación en dos modos:
 *      · Local  → ADC (`gcloud auth application-default login`), sin env de credenciales.
 *      · Vercel/prod → Service Account vía GOOGLE_SA_CLIENT_EMAIL + GOOGLE_SA_PRIVATE_KEY_BASE64
 *        (no hay ADC ni metadata server en serverless, hay que pasar las credenciales).
 */
import { generateText, type LanguageModel, type LanguageModelUsage, Output } from 'ai'
import type { z } from 'zod'

import { isAIEnabled } from './env'
import { scopedLogger } from './logger'

const log = scopedLogger('ai')

/**
 * Modelos por tarea.
 * IDs de modelo Gemini, servidos vía Vertex AI.
 */
export const AI_MODELS = {
  default: 'gemini-2.5-flash',
  summarizer: 'gemini-2.5-flash-lite',
  drafter: 'gemini-2.5-flash-lite',
} as const

/** Timeout máximo por llamada — 30s. */
export const AI_TIMEOUT_MS = 30_000

/**
 * Opciones de autenticación para Vertex.
 * Si la Service Account está en el entorno (Vercel/producción) devuelve sus
 * credenciales explícitas; si no (local), devuelve undefined para que el SDK
 * use ADC automáticamente.
 */
/**
 * Resuelve el modelo de IA según el proveedor configurado en AI_PROVIDER.
 * Solo Vertex está cableado; para reactivar otros proveedores añade su branch
 * aquí (p.ej. gemini / openai / deepseek) y su clave en env.schema.ts.
 */
function resolveModel(modelName: string): LanguageModel {
  throw new Error(`La IA externa está desactivada en la demo (${modelName}).`)
}

/** Registra el consumo de tokens de una llamada para control de coste. */
function logUsage(model: string, usage: LanguageModelUsage | undefined, ms: number): void {
  log.info(
    {
      model,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage?.totalTokens,
      ms,
    },
    'ai_usage',
  )
}

/** Traduce errores de timeout del SDK a un mensaje claro. */
function normalizeAIError(err: unknown): Error {
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return new Error('La IA tardó demasiado en responder (timeout 30s).')
  }
  if (isRetryableStructuredOutputError(err)) {
    return new Error('La IA devolvió un resultado con un formato no válido. Inténtalo de nuevo.')
  }
  return err instanceof Error ? err : new Error('Fallo en la llamada a la IA.')
}

/** Detects provider responses that cannot be parsed as the requested JSON object. */
function isRetryableStructuredOutputError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true
  if (!(err instanceof Error)) return false
  return (
    err.name === 'AI_NoOutputGeneratedError' ||
    err.name === 'AI_NoObjectGeneratedError' ||
    /json\.parse|unexpected (?:token|character)|invalid json|no (?:object|output) generated|response did not match schema|type validation/i.test(
      err.message,
    )
  )
}

export type RunAIChatInput = {
  /** Nombre del modelo (usar AI_MODELS.*). */
  model: string
  /** System prompt — define rol y formato de respuesta. */
  system: string
  /** User prompt — datos del caso concreto. */
  user: string
  /** Temperatura del muestreo. Default 0.3. */
  temperature?: number
  /** Límite de tokens de salida — controla coste y evita truncados. */
  maxOutputTokens?: number
}

/**
 * Ejecuta una chat completion con timeout de 30s y devuelve el texto.
 */
export async function runAIChat(input: RunAIChatInput): Promise<string> {
  if (!isAIEnabled()) {
    throw new Error('La IA externa no está disponible en la demo local.')
  }

  const model = resolveModel(input.model)
  const startedAt = Date.now()

  try {
    const { text, usage } = await generateText({
      model,
      system: input.system,
      prompt: input.user,
      temperature: input.temperature ?? 0.3,
      ...(input.maxOutputTokens ? { maxOutputTokens: input.maxOutputTokens } : {}),
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      providerOptions: {
        vertex: { thinkingConfig: { thinkingBudget: 0 } },
      },
    })

    logUsage(input.model, usage, Date.now() - startedAt)
    if (!text) throw new Error('La IA no devolvió contenido.')
    return text
  } catch (err) {
    throw normalizeAIError(err)
  }
}

export type RunAIObjectInput<S extends z.ZodType> = {
  /** Nombre del modelo (usar AI_MODELS.*). */
  model: string
  /** System prompt — define rol e instrucciones. */
  system: string
  /** User prompt — datos del caso concreto. */
  user: string
  /** Schema Zod que valida y tipa la salida estructurada. */
  schema: S
  /** Temperatura del muestreo. Default 0.3. */
  temperature?: number
  /** Límite de tokens de salida — controla coste y evita truncados. */
  maxOutputTokens?: number
}

/**
 * Genera una respuesta estructurada validada contra un schema Zod, usando el
 * structured-output nativo del proveedor (Gemini responseSchema). Elimina el
 * parseo manual de JSON y garantiza el tipado de la salida.
 *
 * El tipo de retorno se deriva de z.infer<S> (tipo de SALIDA del schema), de
 * modo que los campos con .default() se tratan como obligatorios en el
 * resultado, tal y como Zod los rellena.
 */
export async function runAIObject<S extends z.ZodType>(
  input: RunAIObjectInput<S>,
): Promise<z.infer<S>> {
  if (!isAIEnabled()) {
    throw new Error('La IA externa no está disponible en la demo local.')
  }

  const model = resolveModel(input.model)
  const startedAt = Date.now()

  const generateObject = async (system: string): Promise<z.infer<S>> => {
    const { output, usage } = await generateText({
      model,
      output: Output.object({ schema: input.schema }),
      system,
      prompt: input.user,
      temperature: input.temperature ?? 0.3,
      ...(input.maxOutputTokens ? { maxOutputTokens: input.maxOutputTokens } : {}),
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      // Gemini 2.5 Flash tiene thinking habilitado por defecto. Con Output.object()
      // el thinking budget debe ser 0: si el modelo genera solo tokens de razonamiento
      // sin output estructurado el SDK lanza "No output generated."
      providerOptions: {
        vertex: { thinkingConfig: { thinkingBudget: 0 } },
      },
    })

    logUsage(input.model, usage, Date.now() - startedAt)
    return output
  }

  try {
    return await generateObject(input.system)
  } catch (err) {
    if (!isRetryableStructuredOutputError(err)) throw normalizeAIError(err)

    try {
      return await generateObject(
        `${input.system}\n\nIMPORTANTE: responde exclusivamente con un objeto JSON válido, sin texto, Markdown ni bloques de código alrededor.`,
      )
    } catch (retryErr) {
      throw normalizeAIError(retryErr)
    }
  }
}

export { isAIEnabled }
