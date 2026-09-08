import { describe, expect, it } from 'vitest'

import {
  formatLeadBriefingForAI,
  formatLeadContextForAI,
  formatLeadConversionEventsForAI,
  formatLeadProposalsForAI,
  formatScheduledLeadTasksForAI,
} from './ai-context'

describe('lead AI context', () => {
  it('includes qualification, attribution and Mom Test signals', () => {
    const context = formatLeadContextForAI({
      name: 'María',
      company: 'Acme',
      solution_type: 'Web app',
      urgency: 'Esta semana',
      mom_test_real_problem: true,
      mom_test_decision_power_or_budget: false,
      landing_path: '/contacto',
      first_utm_campaign: 'q3',
    })

    expect(context).toContain('Cualificación: empresa — · solución Web app · urgencia Esta semana')
    expect(context).toContain('Mom Test: problema real sí')
    expect(context).toContain('Atribución inicial: q3')
  })

  it('makes public company research useful for the next AI action', () => {
    const context = formatLeadContextForAI({
      company_research: {
        description: 'Fabricante de maquinaria industrial.',
        sector: 'Industria',
        services: ['Automatización'],
        fit: 'Puede necesitar un portal comercial.',
        priority: 'high',
        reasons: ['Tiene catálogo técnico'],
        cautions: ['Tamaño sin confirmar'],
      },
    })

    expect(context).toContain('sector: Industria')
    expect(context).toContain('servicios: Automatización')
    expect(context).toContain('cautelas: Tamaño sin confirmar')
  })

  it('keeps scheduled tasks and proposal status actionable', () => {
    expect(
      formatScheduledLeadTasksForAI([
        {
          title: 'Llamar para validar presupuesto',
          description: 'Preguntar por disponibilidad esta semana.',
          start_at: '2026-07-15T10:00:00.000Z',
          status: 'todo',
          priority: 'high',
        },
      ]),
    ).toContain('Llamar para validar presupuesto')
    expect(
      formatLeadProposalsForAI([
        {
          number: 'P-001',
          title: 'Web corporativa',
          status: 'viewed',
          total: 5000,
          valid_until: '2026-07-30',
          sent_at: '2026-07-14',
          viewed_at: '2026-07-14',
          responded_at: null,
          notes: null,
        },
      ]),
    ).toContain('estado: viewed')
    expect(
      formatLeadConversionEventsForAI([
        {
          event_name: 'form_submit',
          conversion_step: 'contact',
          landing_path: '/contacto',
          referrer: 'google',
          utm_source: 'google',
          utm_campaign: 'brand',
          created_at: '2026-07-14T10:00:00.000Z',
        },
      ]),
    ).toContain('form_submit')
  })

  it("builds a portable briefing with the lead's commercial context", () => {
    const briefing = formatLeadBriefingForAI({
      lead: { name: 'María', company: 'Acme', status: 'quoted' },
      clientName: 'Acme SL',
      interactions: [
        {
          type: 'note',
          subject: 'Seguimiento',
          body: 'Quiere decidirlo esta semana.',
          payload: null,
          created_at: '2026-07-15T10:00:00.000Z',
        },
      ],
      proposals: [],
      projects: [{ name: 'Portal de clientes', status: 'active', description: 'Fase dos.' }],
      invoices: [
        { full_number: 'F-2026-01', status: 'sent', total: 1200, issue_date: '2026-07-01' },
      ],
      tasks: [
        {
          title: 'Validar presupuesto',
          status: 'todo',
          due_date: '2026-07-20',
          description: null,
          priority: 'high',
        },
      ],
      reminders: [{ title: 'Llamar', remind_at: '2026-07-18T09:00:00.000Z' }],
      attachments: [{ name: 'brief.pdf', mime_type: 'application/pdf' }],
    })

    expect(briefing).toContain('# Briefing CRM para IA')
    expect(briefing).toContain('Cliente vinculado: Acme SL')
    expect(briefing).toContain('Quiere decidirlo esta semana.')
    expect(briefing).toContain('Portal de clientes')
    expect(briefing).toContain('F-2026-01')
    expect(briefing).toContain('brief.pdf')
  })
})
