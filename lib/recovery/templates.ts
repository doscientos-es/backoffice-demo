/**
 * Reason-aware recovery email templates for Sara's re-engagement flow.
 *
 * Keys mirror the `lost_reason` presets defined in `close-reason-dialog.tsx`
 * (lost + not_interested variants). Any custom / unknown reason falls back to
 * `DEFAULT_TEMPLATE`. Bodies are Markdown and reuse the same `{{nombre}}` /
 * `{{empresa}}` variables the EmailComposer already interpolates server-side,
 * so no extra wiring is needed.
 */

export type RecoveryTemplate = {
  subject: string
  /** Markdown body. Signature is appended by the send action. */
  body: string
}

const INFO_LINK =
  'Te dejo también [esta página para revisar cómo trabajamos](https://www.doscientos.es).'

const DEFAULT_TEMPLATE: RecoveryTemplate = {
  subject: '¿Retomamos lo que dejamos pendiente, {{nombre}}?',
  body: [
    'Hola **{{nombre}}**,',
    '',
    'Hace un tiempo estuvimos en contacto y no llegamos a cerrar nada. Me gustaría',
    'entender qué te frenó y ver si ahora encaja mejor.',
    '',
    '¿Te viene bien una llamada breve esta semana?',
    '',
    'Un saludo.',
  ].join('\n'),
}

/** Inserts `snippet` just before the "Un saludo." sign-off, or appends it. */
function insertBeforeSignoff(body: string, snippet: string): string {
  const lines = body.split('\n')
  const signoffIndex = lines.findIndex((line) => line.trim().toLowerCase() === 'un saludo.')
  if (signoffIndex === -1) return `${body}\n\n${snippet}`
  return [...lines.slice(0, signoffIndex), snippet, '', ...lines.slice(signoffIndex)].join('\n')
}

function withInfoLink(template: RecoveryTemplate): RecoveryTemplate {
  if (template.body.includes('https://www.doscientos.es')) return template
  return { ...template, body: insertBeforeSignoff(template.body, INFO_LINK) }
}

/**
 * Appends a personalized self-service booking link so the lead can grab a slot
 * without back-and-forth. The URL is built per-lead (see `buildBookingUrl`) and
 * is click-tracked by the send pipeline.
 */
function withBookingLink(template: RecoveryTemplate, bookingUrl: string): RecoveryTemplate {
  const snippet = `¿Prefieres ir al grano? [Reserva una reunión cuando mejor te venga](${bookingUrl}).`
  return { ...template, body: insertBeforeSignoff(template.body, snippet) }
}

/**
 * Templates keyed by the exact `lost_reason` preset strings. Kept as data (not
 * logic) so adding a reason is a one-line change — Open/Closed friendly.
 */
const TEMPLATES: Record<string, RecoveryTemplate> = {
  Precio: {
    subject: 'Una propuesta ajustada para {{empresa}}',
    body: [
      'Hola **{{nombre}}**,',
      '',
      'Sé que el presupuesto fue el punto que nos frenó. Hemos revisado opciones y',
      'creo que puedo ofrecerte una alternativa que encaje mejor con lo que buscabais',
      'en {{empresa}} sin renunciar a lo importante.',
      '',
      '¿Te parece si lo vemos en 15 minutos?',
      '',
      'Un saludo.',
    ].join('\n'),
  },
  'Timing / Calendario': {
    subject: '¿Es mejor momento ahora, {{nombre}}?',
    body: [
      'Hola **{{nombre}}**,',
      '',
      'Cuando hablamos no era el momento adecuado para {{empresa}}. Ha pasado un',
      'tiempo y quería retomarlo por si ahora encaja mejor en vuestros planes.',
      '',
      '¿Lo comentamos brevemente?',
      '',
      'Un saludo.',
    ].join('\n'),
  },
  'Eligió competencia': {
    subject: '¿Cómo va todo por {{empresa}}?',
    body: [
      'Hola **{{nombre}}**,',
      '',
      'En su momento optasteis por otra opción, algo totalmente comprensible.',
      'Quería saber cómo os está funcionando y si hay algo en lo que podamos ayudar',
      'desde nuestro lado.',
      '',
      'Sigo a tu disposición.',
      '',
      'Un saludo.',
    ].join('\n'),
  },
  'No es buen fit': {
    subject: 'Puede que ahora encajemos mejor, {{nombre}}',
    body: [
      'Hola **{{nombre}}**,',
      '',
      'Cuando hablamos concluimos que no era el encaje ideal. Hemos evolucionado',
      'bastante desde entonces y quizá ahora tenga más sentido para {{empresa}}.',
      '',
      '¿Te cuento las novedades en una llamada corta?',
      '',
      'Un saludo.',
    ].join('\n'),
  },
  'Sin respuesta': {
    subject: 'Sigo por aquí, {{nombre}}',
    body: [
      'Hola **{{nombre}}**,',
      '',
      'Te escribí hace un tiempo y no llegamos a coincidir. No quiero insistir de más,',
      'solo confirmar si sigue teniendo interés para {{empresa}} o prefieres que lo',
      'dejemos aquí.',
      '',
      'Cualquiera de las dos respuestas me ayuda.',
      '',
      'Un saludo.',
    ].join('\n'),
  },
  'Sin presupuesto': {
    subject: 'Opciones más ligeras para {{empresa}}',
    body: [
      'Hola **{{nombre}}**,',
      '',
      'Entiendo que el presupuesto no daba en aquel momento. Tenemos formas de',
      'empezar con un alcance más reducido y crecer poco a poco.',
      '',
      '¿Te enseño cómo sería?',
      '',
      'Un saludo.',
    ].join('\n'),
  },
}

/**
 * Returns the best-matching template for a lost reason, falling back to a
 * generic re-engagement message when the reason is empty or unmapped. When a
 * `bookingUrl` is provided, a self-service scheduling link is appended so the
 * lead can book a meeting directly.
 */
export function getRecoveryTemplate(
  reason: string | null | undefined,
  opts?: { bookingUrl?: string | null },
): RecoveryTemplate {
  const base = reason ? (TEMPLATES[reason.trim()] ?? DEFAULT_TEMPLATE) : DEFAULT_TEMPLATE
  const withInfo = withInfoLink(base)
  const bookingUrl = opts?.bookingUrl?.trim()
  return bookingUrl ? withBookingLink(withInfo, bookingUrl) : withInfo
}
