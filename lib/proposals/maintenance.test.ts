import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAINTENANCE_OFFER,
  maintenancePlanAsLineItem,
  parseMaintenanceOffer,
  recommendedMaintenancePlanId,
  selectedMaintenancePlan,
} from './maintenance'

describe('proposal maintenance offer', () => {
  it('uses the public maintenance plans when a proposal has no custom snapshot', () => {
    expect(parseMaintenanceOffer(null)).toEqual(DEFAULT_MAINTENANCE_OFFER)
    expect(parseMaintenanceOffer({ plans: [] })).toEqual(DEFAULT_MAINTENANCE_OFFER)
  })

  it('keeps legacy offers enabled and excludes selected plans when disabled', () => {
    const legacyOffer = { ...DEFAULT_MAINTENANCE_OFFER }
    delete (legacyOffer as Partial<typeof legacyOffer>).enabled

    expect(parseMaintenanceOffer(legacyOffer).enabled).toBe(true)
    expect(
      selectedMaintenancePlan({ ...DEFAULT_MAINTENANCE_OFFER, enabled: false }, 'growth'),
    ).toBeNull()
  })

  it('keeps legacy snapshots valid by defaulting their exclusions to an empty list', () => {
    const legacyOffer = {
      ...DEFAULT_MAINTENANCE_OFFER,
      plans: DEFAULT_MAINTENANCE_OFFER.plans.map(({ exclusions: _exclusions, ...plan }) => plan),
    }

    expect(
      parseMaintenanceOffer(legacyOffer).plans.every((plan) => plan.exclusions.length === 0),
    ).toBe(true)
  })

  it('defaults legacy offers to their second plan and preserves a configured recommendation', () => {
    const legacyOffer = {
      ...DEFAULT_MAINTENANCE_OFFER,
      recommended_plan_id: undefined,
    }
    expect(recommendedMaintenancePlanId(parseMaintenanceOffer(legacyOffer))).toBe('growth')
    expect(
      recommendedMaintenancePlanId({
        ...DEFAULT_MAINTENANCE_OFFER,
        recommended_plan_id: 'essential',
      }),
    ).toBe('essential')
  })

  it('turns the selected plan into a monthly proposal line', () => {
    const plan = selectedMaintenancePlan(DEFAULT_MAINTENANCE_OFFER, 'growth')
    expect(plan?.name).toBe('Crecimiento')
    expect(maintenancePlanAsLineItem(plan!)).toMatchObject({
      description: 'Mantenimiento web · Crecimiento',
      unit_price: 100,
      vat_rate: 21,
      billing_cycle: 'monthly',
    })
  })

  it('does not fabricate a selection for an unknown or omitted plan', () => {
    expect(selectedMaintenancePlan(DEFAULT_MAINTENANCE_OFFER, null)).toBeNull()
    expect(selectedMaintenancePlan(DEFAULT_MAINTENANCE_OFFER, 'unknown')).toBeNull()
  })
})
