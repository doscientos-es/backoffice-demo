export const LEAD_SOURCES = [
  'Landing',
  'Anuncios Meta',
  'Cal.com',
  'Referencia',
  'Conocido',
  'LinkedIn',
  'Email',
  'Evento',
  'Otro',
] as const

export const COMPANY_SIZE_OPTIONS = [
  '1-10 empleados',
  '10-50 empleados',
  '50-200 empleados',
  'Más de 200 empleados',
] as const

export const URGENCY_OPTIONS = ['Inmediata', 'Este mes', 'Este trimestre', 'Explorando'] as const

export const SOLUTION_TYPES = [
  'Software a medida',
  'App móvil',
  'Web corporativa',
  'E-commerce',
  'Consultoría técnica',
  'Otro',
] as const

const SOURCE_ALIASES = new Map<string, (typeof LEAD_SOURCES)[number]>([
  ['landing', 'Landing'],
  ['landing_form', 'Landing'],
  ['cal.com', 'Cal.com'],
  ['cal', 'Cal.com'],
  ['meta', 'Anuncios Meta'],
  ['meta_lead_ads', 'Anuncios Meta'],
  ['anuncios meta', 'Anuncios Meta'],
])

export function normalizeLeadSource(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const alias = SOURCE_ALIASES.get(trimmed.toLowerCase())
  if (alias) return alias
  const known = LEAD_SOURCES.find((source) => source.toLowerCase() === trimmed.toLowerCase())
  return known ?? trimmed
}

export function normalizeCompanySize(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const compact = trimmed.toLowerCase().replace(/\s+/g, ' ')
  if (compact === '1-10' || compact === '1–10') return '1-10 empleados'
  if (compact === '10-50' || compact === '10–50') return '10-50 empleados'
  if (compact === '50-200' || compact === '50–200') return '50-200 empleados'
  if (compact === '200+' || compact === '+200' || compact.includes('200+')) {
    return 'Más de 200 empleados'
  }
  const known = COMPANY_SIZE_OPTIONS.find((option) => option.toLowerCase() === compact)
  return known ?? trimmed
}

export function normalizeUrgency(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const compact = trimmed.toLowerCase()
  if (
    compact === 'sin urgencia' ||
    compact === 'solo informacion' ||
    compact === 'solo información'
  ) {
    return 'Explorando'
  }
  const known = URGENCY_OPTIONS.find((option) => option.toLowerCase() === compact)
  return known ?? trimmed
}
