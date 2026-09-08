import pino, { type Logger } from 'pino'

let cached: Logger | null = null

/**
 * Structured logger to stdout (pino).
 * In dev: pretty-printed; in prod: JSON for log aggregators.
 */
export function logger(): Logger {
  if (cached) return cached
  cached = pino({
    level: 'info',
    base: { app: 'backoffice-demo' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.authorization',
        '*.password',
        '*.token',
      ],
      remove: true,
    },
  })
  return cached
}

/** Returns a child logger scoped to a feature / module name. */
export function scopedLogger(scope: string): Logger {
  return logger().child({ scope })
}
