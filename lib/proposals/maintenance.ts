import { z } from 'zod'

import type { BillingCycle } from '@/lib/finance'

export const MAINTENANCE_LIMITS = {
  maxCoverageItems: 12,
  maxCoverageLength: 240,
  maxExclusionItems: 12,
  maxExclusionLength: 240,
  maxPlans: 6,
} as const

export const maintenancePlanInput = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, 'El nombre del plan es obligatorio').max(80),
  summary: z.string().trim().min(1, 'Describe qué cubre el plan').max(400),
  monthly_price: z.coerce.number().min(0).max(100_000),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
  coverage: z
    .array(z.string().trim().min(1).max(MAINTENANCE_LIMITS.maxCoverageLength))
    .max(MAINTENANCE_LIMITS.maxCoverageItems),
  exclusions: z
    .array(z.string().trim().min(1).max(MAINTENANCE_LIMITS.maxExclusionLength))
    .max(MAINTENANCE_LIMITS.maxExclusionItems)
    .default([]),
})

export const maintenanceOfferInput = z
  .object({
    enabled: z.boolean().default(true),
    heading: z.string().trim().min(1).max(120),
    intro: z.string().trim().min(1).max(800),
    plans: z.array(maintenancePlanInput).min(1).max(MAINTENANCE_LIMITS.maxPlans),
    recommended_plan_id: z.string().min(1).max(64).optional(),
  })
  .superRefine((offer, ctx) => {
    if (
      offer.recommended_plan_id &&
      !offer.plans.some((plan) => plan.id === offer.recommended_plan_id)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recommended_plan_id'],
        message: 'El plan recomendado debe existir en la propuesta',
      })
    }
  })

export type MaintenancePlan = z.infer<typeof maintenancePlanInput>
export type MaintenanceOffer = z.infer<typeof maintenanceOfferInput>

/** Default proposal copy, based on https://doscientos.es/precios-mantenimiento. */
export const DEFAULT_MAINTENANCE_OFFER: MaintenanceOffer = {
  enabled: true,
  heading: 'Mantenimiento web',
  intro:
    'Tu web al día, sin sorpresas. Seguridad, soporte y mejoras con un alcance claro para que elijas cuánto quieres que nos impliquemos.',
  recommended_plan_id: 'growth',
  plans: [
    {
      id: 'essential',
      name: 'Esencial',
      summary: 'La base técnica y una red de seguridad para que la web siga disponible.',
      monthly_price: 80,
      vat_rate: 21,
      coverage: [
        'Hosting e infraestructura',
        'Monitorización básica',
        'Actualizaciones técnicas',
        'Backups y seguridad',
        'Corrección de errores críticos',
        'Soporte por email',
      ],
      exclusions: [
        'Cambios de contenido o diseño',
        'Nuevas funcionalidades e integraciones',
        'Correcciones no relacionadas con la web entregada',
      ],
    },
    {
      id: 'growth',
      name: 'Crecimiento',
      summary: 'Soporte, seguridad y tiempo mensual para mantener la web cuidada.',
      monthly_price: 100,
      vat_rate: 21,
      coverage: [
        'Todo lo incluido en Esencial',
        'Soporte por email y WhatsApp',
        'Hasta 1 h/mes para cambios pequeños',
        'Revisión trimestral',
        'Analítica y rendimiento básico',
      ],
      exclusions: [
        'Desarrollos a medida de gran alcance',
        'Integraciones o licencias de terceros',
        'Migraciones de contenido complejas',
      ],
    },
    {
      id: 'evolution',
      name: 'Evolución',
      summary: 'Una bolsa de trabajo prioritaria para iterar y mejorar cada mes.',
      monthly_price: 450,
      vat_rate: 21,
      coverage: [
        'Soporte prioritario',
        'Hasta 4 h/mes para cambios y mejoras',
        'Pequeñas funcionalidades nuevas',
        'Revisión mensual',
        'Evolución continua limitada',
      ],
      exclusions: [
        'Proyectos o funcionalidades de gran alcance',
        'Servicios, licencias y herramientas de terceros',
        'Trabajo no utilizado durante el mes',
      ],
    },
  ],
}

/** Keeps legacy offers on the second plan while allowing each proposal to override it. */
export function recommendedMaintenancePlanId(offer: MaintenanceOffer): string | null {
  if (
    offer.recommended_plan_id &&
    offer.plans.some((plan) => plan.id === offer.recommended_plan_id)
  ) {
    return offer.recommended_plan_id
  }
  return offer.plans[1]?.id ?? offer.plans[0]?.id ?? null
}

export function parseMaintenanceOffer(value: unknown): MaintenanceOffer {
  const parsed = maintenanceOfferInput.safeParse(value)
  if (!parsed.success) return DEFAULT_MAINTENANCE_OFFER
  return {
    ...parsed.data,
    recommended_plan_id: recommendedMaintenancePlanId(parsed.data) ?? undefined,
  }
}

export function selectedMaintenancePlan(
  offer: MaintenanceOffer,
  selectedPlanId: string | null | undefined,
): MaintenancePlan | null {
  if (!offer.enabled || !selectedPlanId) return null
  return offer.plans.find((plan) => plan.id === selectedPlanId) ?? null
}

export function maintenancePlanAsLineItem(plan: MaintenancePlan) {
  return {
    id: `maintenance-${plan.id}`,
    description: `Mantenimiento web · ${plan.name}`,
    quantity: 1,
    unit_price: plan.monthly_price,
    vat_rate: plan.vat_rate,
    subtotal: plan.monthly_price,
    billing_cycle: 'monthly' as BillingCycle,
  }
}
