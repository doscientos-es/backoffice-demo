/**
 * Definición central de atajos de teclado tipo "chord" secuencial:
 * - `g` + tecla → navegar a una sección (ir a).
 * - `c` + tecla → crear una entidad nueva.
 *
 * Se usan chords sin modificador a propósito: las combinaciones con
 * Ctrl/Cmd las captura el navegador y Alt choca con la barra de menú y
 * los accesskeys en Windows. Un chord secuencial no tiene esos problemas.
 */

export type Shortcut = {
  /** Ruta destino. */
  href: string
  /** Etiqueta legible. */
  label: string
  /** Segunda tecla del chord (siempre en minúscula). */
  key: string
}

/** Secciones navegables vía `g` + tecla (las más usadas). */
export const NAV_SHORTCUTS: Shortcut[] = [
  { href: '/inicio', label: 'Inicio', key: 'i' },
  { href: '/leads', label: 'Leads', key: 'l' },
  { href: '/marketing', label: 'Publicidad', key: 'm' },
  { href: '/marketing/newsletters', label: 'Newsletters', key: 'n' },
  { href: '/clients', label: 'Clientes', key: 'c' },
  { href: '/projects', label: 'Proyectos', key: 'p' },
  { href: '/webs', label: 'Webs', key: 'w' },
  { href: '/proposals', label: 'Propuestas', key: 'r' },
  { href: '/invoices', label: 'Facturas', key: 'f' },
  { href: '/subscriptions', label: 'Suscripciones', key: 's' },
  { href: '/finance/expenses', label: 'Gastos', key: 'x' },
  { href: '/tasks', label: 'Tareas', key: 't' },
  { href: '/reminders', label: 'Recordatorios', key: 'a' },
  { href: '/vault', label: 'Bóveda', key: 'v' },
]

/** Creación rápida vía `c` + tecla. */
export const CREATE_SHORTCUTS: Shortcut[] = [
  { href: '/leads/new', label: 'Nuevo lead', key: 'l' },
  { href: '/clients/new', label: 'Nuevo cliente', key: 'c' },
  { href: '/projects/new', label: 'Nuevo proyecto', key: 'p' },
  { href: '/tasks/new', label: 'Nueva tarea', key: 't' },
  { href: '/proposals/new', label: 'Nueva propuesta', key: 'r' },
]

/** Devuelve el atajo cuya segunda tecla coincide, o undefined. */
export function findShortcut(list: Shortcut[], key: string): Shortcut | undefined {
  const k = key.toLowerCase()
  return list.find((s) => s.key === k)
}

export type RecentItem = {
  href: string
  label: string
  type?: string
}

/** Clave de localStorage para los elementos recientes del command palette. */
export const RECENTS_STORAGE_KEY = 'doscientos:command-recents'

/**
 * Inserta `item` al principio de la lista de recientes, deduplicando por
 * `href` y limitando a `max` elementos. Función pura (testeable).
 */
export function mergeRecentItems(list: RecentItem[], item: RecentItem, max = 5): RecentItem[] {
  const deduped = list.filter((r) => r.href !== item.href)
  return [item, ...deduped].slice(0, max)
}
