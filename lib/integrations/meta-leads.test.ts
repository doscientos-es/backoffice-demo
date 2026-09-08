import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  type MetaLeadgenResponse,
  mapMetaLeadgenToIntake,
  verifyMetaSignature,
} from '@/lib/integrations/meta-leads'

const APP_SECRET = 'test_app_secret_value'

function sign(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

describe('verifyMetaSignature', () => {
  it('accepts a correctly-signed payload', () => {
    const body = JSON.stringify({ object: 'page', entry: [] })
    expect(verifyMetaSignature(APP_SECRET, body, sign(APP_SECRET, body))).toBe(true)
  })

  it('accepts signature without sha256= prefix', () => {
    const body = 'payload'
    const hex = sign(APP_SECRET, body).slice(7)
    expect(verifyMetaSignature(APP_SECRET, body, hex)).toBe(true)
  })

  it('rejects tampered body', () => {
    const body = JSON.stringify({ object: 'page' })
    const sig = sign(APP_SECRET, body)
    expect(verifyMetaSignature(APP_SECRET, `${body}x`, sig)).toBe(false)
  })

  it('rejects wrong secret', () => {
    const body = 'x'
    expect(verifyMetaSignature(APP_SECRET, body, sign('other', body))).toBe(false)
  })

  it('rejects missing/empty signature', () => {
    expect(verifyMetaSignature(APP_SECRET, 'x', null)).toBe(false)
    expect(verifyMetaSignature(APP_SECRET, 'x', '')).toBe(false)
    expect(verifyMetaSignature(APP_SECRET, 'x', 'sha256=')).toBe(false)
  })

  it('rejects when appSecret is empty', () => {
    expect(verifyMetaSignature('', 'x', sign('x', 'x'))).toBe(false)
  })
})

describe('mapMetaLeadgenToIntake', () => {
  const base: MetaLeadgenResponse = {
    id: 'lg_123',
    created_time: '2026-05-26T10:00:00+0000',
    field_data: [
      { name: 'full_name', values: ['Marta García'] },
      { name: 'email', values: ['marta@example.com'] },
      { name: 'phone_number', values: ['+34600111222'] },
      { name: 'company_name', values: ['Acme SL'] },
    ],
    ad_id: 'ad_1',
    adset_id: 'adset_1',
    campaign_id: 'camp_1',
    form_id: 'form_1',
    platform: 'fb',
  }

  it('maps standard English field names', () => {
    const out = mapMetaLeadgenToIntake(base)
    expect(out.name).toBe('Marta García')
    expect(out.email).toBe('marta@example.com')
    expect(out.phone).toBe('+34600111222')
    expect(out.company).toBe('Acme SL')
    expect(out.externalId).toBe('lg_123')
    expect(out.externalSource).toBe('Anuncios Meta')
    expect(out.source).toBe('Anuncios Meta')
  })

  it('propagates ad / adset / campaign into utm', () => {
    const out = mapMetaLeadgenToIntake(base)
    expect(out.utm?.source).toBe('facebook')
    expect(out.utm?.medium).toBe('paid_social')
    expect(out.utm?.campaign).toBe('camp_1')
    expect(out.utm?.content).toBe('ad_1')
    expect(out.utm?.term).toBe('adset_1')
  })

  it('falls back to first_name + last_name when full_name missing', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: 'first_name', values: ['Marta'] },
        { name: 'last_name', values: ['García'] },
        { name: 'email', values: ['m@x.com'] },
      ],
    })
    expect(out.name).toBe('Marta García')
  })

  it('accepts Spanish localized field names', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: 'nombre_completo', values: ['Pol G'] },
        { name: 'correo_electronico', values: ['pol@x.com'] },
        { name: 'telefono', values: ['600'] },
        { name: 'empresa', values: ['Doscientos'] },
      ],
    })
    expect(out.name).toBe('Pol G')
    expect(out.email).toBe('pol@x.com')
    expect(out.phone).toBe('600')
    expect(out.company).toBe('Doscientos')
  })

  it('defaults to placeholder when no name field present', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [{ name: 'email', values: ['x@y.com'] }],
    })
    expect(out.name).toBe('Lead sin nombre')
  })

  it('stores raw payload for audit', () => {
    const out = mapMetaLeadgenToIntake(base, { pageId: 'page_99', createdTime: 1700000000 })
    expect(out.rawPayload).toMatchObject({
      id: 'lg_123',
      webhookCtx: { pageId: 'page_99', createdTime: 1700000000 },
    })
  })

  it('keeps only non-structured answers in notes', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: 'full_name', values: ['Test User'] },
        { name: '¿Tamaño de empresa?', values: ['10-50 empleados'] },
        { name: '¿Qué solución necesitas desarrollar?', values: ['Software a Medida'] },
        { name: '¿Cuál es tu presupuesto estimado?', values: ['Más de 10.000€'] },
        { name: '¿Algo más que debamos saber?', values: ['Necesitamos integración con ERP'] },
      ],
    })
    expect(out.notes).toBe('Algo más que debamos saber: Necesitamos integración con ERP')
  })

  it('parses budget into estimatedValue (lower bound of range)', () => {
    const cases: Array<[string, number]> = [
      ['Más de 10.000€', 10000],
      ['Menos de 5.000€', 5000],
      ['5.000€ - 10.000€', 5000],
    ]
    for (const [text, expected] of cases) {
      const out = mapMetaLeadgenToIntake({
        ...base,
        field_data: [
          { name: 'full_name', values: ['Test'] },
          { name: '¿Cuál es tu presupuesto estimado?', values: [text] },
        ],
      })
      expect(out.estimatedValue).toBe(expected)
    }
  })

  it('returns null estimatedValue when no budget field present', () => {
    const out = mapMetaLeadgenToIntake(base)
    expect(out.estimatedValue).toBeNull()
  })

  it('returns null notes when no custom form fields are present', () => {
    const out = mapMetaLeadgenToIntake(base)
    expect(out.notes).toBeNull()
  })

  it('prettifies snake_case field IDs and values into readable labels', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: 'full_name', values: ['Test'] },
        { name: 'tamaño_de_empresa', values: ['10-50_empleados'] },
        { name: 'qué_solución_necesitas_desarrollar', values: ['software_a_medida'] },
        { name: 'cuando_necesitarías_incorporar_la_solución', values: ['lo_antes_posible'] },
      ],
    })
    expect(out.companySize).toBe('10-50 empleados')
    expect(out.solutionType).toBe('Software a medida')
    expect(out.urgency).toBe('Lo antes posible')
    expect(out.notes).toBeNull()
  })

  it('infers urgency from answer value when label is not classifiable', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: 'full_name', values: ['Test'] },
        { name: 'comentario_libre', values: ['Lo antes posible'] },
      ],
    })
    expect(out.urgency).toBe('Lo antes posible')
    expect(out.notes).toBe('Comentario libre: Lo antes posible')
  })

  it('extracts qualification fields using classifyFormAnswers keywords', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: 'full_name', values: ['Test'] },
        { name: '¿Tamaño de empresa?', values: ['10-50 empleados'] },
        { name: '¿Qué solución necesitas desarrollar?', values: ['Software a Medida'] },
        { name: '¿Cuál es la urgencia?', values: ['Inmediata'] },
      ],
    })
    expect(out.companySize).toBe('10-50 empleados')
    expect(out.solutionType).toBe('Software a Medida')
    expect(out.urgency).toBe('Inmediata')
  })

  it('prioritizes explicit urgency field over keyword classification', () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: 'full_name', values: ['Test'] },
        { name: 'urgencia', values: ['Crítica'] },
        { name: '¿Para cuándo necesitas el proyecto?', values: ['Mañana'] },
      ],
    })
    expect(out.urgency).toBe('Crítica')
  })

  it("uses 'Anuncios Meta' as source and externalSource", () => {
    const out = mapMetaLeadgenToIntake(base)
    expect(out.source).toBe('Anuncios Meta')
    expect(out.externalSource).toBe('Anuncios Meta')
  })
})
