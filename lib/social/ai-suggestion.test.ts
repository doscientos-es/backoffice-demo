import { describe, expect, it } from 'vitest'

import {
  buildSocialSuggestionPrompt,
  finalizeSocialSuggestion,
  formatSocialContext,
  normalizeHashtags,
  SocialPostSuggestionSchema,
} from './ai-suggestion'

describe('social post AI context', () => {
  it('formats commercial signals without direct lead identifiers', () => {
    const context = formatSocialContext({
      company: {
        name: 'doscientos',
        positioning: 'Agencia de desarrollo web y producto digital',
      },
      leads: [
        {
          status: 'qualifying',
          temperature: 'hot',
          score: 87,
          companySize: '10-50',
          solutionType: 'Web a medida',
          urgency: 'Este mes',
          notes: 'No sabe cómo medir resultados. Contacto email@example.com, +34 600 000 000',
          aiSummary: 'Necesita claridad para decidir',
          aiTags: ['medición'],
          momTest: {
            realProblem: true,
            awareProblem: true,
            triedSolutions: false,
            decisionPowerOrBudget: true,
            accessible: true,
          },
        },
      ],
      projects: [{ name: 'Portal B2B', status: 'done', description: 'Flujo de pedidos' }],
      painPoints: [{ type: 'meeting', subject: 'Bloqueo', body: 'No consigue medir conversiones' }],
    })

    expect(context).toContain('Web a medida')
    expect(context).toContain('No consigue medir conversiones')
    expect(context).not.toContain('email@example.com')
    expect(context).not.toContain('+34 600 000 000')
  })

  it('includes the optional directive and guards against prompt-injection wording in data', () => {
    const prompt = buildSocialSuggestionPrompt('Hazlo sobre onboarding', {
      company: {
        name: 'doscientos',
        positioning: 'Agencia de desarrollo web y producto digital',
      },
      leads: [],
      projects: [],
      painPoints: [],
    })

    expect(prompt).toContain('Hazlo sobre onboarding')
    expect(prompt).toContain('No inventes casos')
    expect(prompt).toContain('[Nombre de la Agencia]')
  })

  it('validates the structured response contract', () => {
    const suggestion = SocialPostSuggestionSchema.parse({
      title: 'Una web que se entiende',
      angle: 'Explicar claridad antes que tecnología',
      audience: 'Empresas que están comparando proveedores',
      rationale: 'Aparece como necesidad repetida en los leads',
      visualConcept: 'Una pantalla con dos caminos claros',
      layout: 'Plano cenital, pantalla centrada y texto arriba',
      photoBrief: 'Fotografiar la pantalla en una mesa limpia',
      caption: 'La mejor tecnología no compensa una experiencia confusa.',
      callToAction: '¿Te pasa? Hablemos.',
      hashtags: ['#productoDigital'],
    })

    expect(suggestion.caption).toContain('experiencia confusa')
  })

  it('normalizes model hashtags for publishing', () => {
    expect(normalizeHashtags(['SoftwareAMedida', '#softwareamedida', ' DesarrolloWeb '])).toEqual([
      '#SoftwareAMedida',
      '#DesarrolloWeb',
    ])
  })

  it('replaces agency placeholders with the configured company name', () => {
    const suggestion = SocialPostSuggestionSchema.parse({
      title: 'Una idea',
      angle: 'Un enfoque',
      audience: 'Empresas',
      rationale: 'Es relevante',
      visualConcept: 'Una foto',
      layout: 'Plano cenital',
      photoBrief: 'Haz la foto',
      caption: 'En [Nombre de la Agencia], hacemos producto digital.',
      callToAction: 'Habla con Nombre de la Agencia',
      hashtags: [],
    })

    const finalized = finalizeSocialSuggestion(suggestion, 'doscientos')
    expect(finalized.caption).toBe('En doscientos, hacemos producto digital.')
    expect(finalized.callToAction).toBe('Habla con doscientos')
  })
})
