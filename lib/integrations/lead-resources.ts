export type LeadResource = {
  slug: string
  title: string
  description: string
  href: string
  cta: string
}

const SITE_URL = 'https://doscientos.es'

const RESOURCES = {
  'calculadora-coste-oculto': {
    slug: 'calculadora-coste-oculto',
    title: 'Calculadora del coste del trabajo manual',
    description:
      'Calcula cuántas horas y cuánto dinero consume cada año ese proceso repetitivo de tu equipo.',
    href: `${SITE_URL}/automatizar-excel?ref=email-confirmacion#calculadora-coste`,
    cta: 'Abrir calculadora',
  },
  'recurso-checklist-crm-excel': {
    slug: 'recurso-checklist-crm-excel',
    title: 'Checklist para saber si Excel ya no puede ser tu CRM',
    description:
      'Senales, riesgos y criterios para decidir si toca pasar de una hoja a un sistema trazable.',
    href: `${SITE_URL}/recursos/excel-como-crm-cuando-cambiar?ref=email-recurso-crm`,
    cta: 'Abrir checklist',
  },
  'recurso-guia-mvp': {
    slug: 'recurso-guia-mvp',
    title: 'Guia para validar un MVP sin construir de mas',
    description:
      'Una estructura de 6 semanas para validar alcance, usuarios, metricas y siguiente decision.',
    href: `${SITE_URL}/recursos/validar-mvp-6-semanas?ref=email-recurso-mvp`,
    cta: 'Abrir guia',
  },
  'recurso-guia-coste-app': {
    slug: 'recurso-guia-coste-app',
    title: 'Guia de presupuesto para una app en 2026',
    description: 'Rangos, partidas y decisiones que cambian el coste antes de pedir presupuesto.',
    href: `${SITE_URL}/recursos/cuanto-cuesta-desarrollar-app-2026?ref=email-recurso-coste-app`,
    cta: 'Abrir guia',
  },
  'recurso-plantilla-saas-vs-medida': {
    slug: 'recurso-plantilla-saas-vs-medida',
    title: 'Plantilla para comparar SaaS vs software a medida',
    description:
      'Una matriz simple para comparar coste total, control, integraciones, riesgo y dependencia.',
    href: `${SITE_URL}/recursos/software-a-medida-vs-saas?ref=email-recurso-saas-vs-medida`,
    cta: 'Abrir plantilla',
  },
  'recurso-checklist-automatizacion': {
    slug: 'recurso-checklist-automatizacion',
    title: 'Checklist para elegir que automatizar primero',
    description:
      'Puntua procesos por horas, riesgo, frecuencia y retorno antes de invertir en software.',
    href: `${SITE_URL}/recursos/automatizacion-procesos-empresariales?ref=email-recurso-automatizacion`,
    cta: 'Abrir checklist',
  },
} satisfies Record<string, LeadResource>

type SelectLeadResourceInput = {
  resourceSlug?: string | null
  landingRef?: string | null
  landingSubject?: string | null
  calculatorCost?: string | null
  calculatorHours?: string | null
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function selectLeadResource(input: SelectLeadResourceInput): LeadResource {
  if (input.resourceSlug && input.resourceSlug in RESOURCES) {
    return RESOURCES[input.resourceSlug as keyof typeof RESOURCES]
  }

  if (input.calculatorCost || input.calculatorHours || input.landingRef?.includes('calculadora')) {
    return RESOURCES['calculadora-coste-oculto']
  }

  const text = normalize([input.landingRef, input.landingSubject].filter(Boolean).join(' '))
  if (text.includes('crm') || text.includes('excel') || text.includes('renovacion')) {
    return RESOURCES['recurso-checklist-crm-excel']
  }
  if (text.includes('mvp') || text.includes('app')) {
    return RESOURCES['recurso-guia-mvp']
  }
  if (text.includes('saas') || text.includes('medida')) {
    return RESOURCES['recurso-plantilla-saas-vs-medida']
  }

  return RESOURCES['recurso-checklist-automatizacion']
}
