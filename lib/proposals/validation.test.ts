import { describe, expect, it } from 'vitest'

import { formatProposalValidationIssues } from './validation'

describe('formatProposalValidationIssues', () => {
  it('identifies nested proposal fields in actionable language', () => {
    expect(
      formatProposalValidationIssues([
        { path: ['scope_modules', 0, 'title'], message: 'El nombre del módulo es obligatorio' },
        { path: ['items', 1, 'quantity'], message: 'Cantidad > 0' },
      ]),
    ).toEqual([
      'Módulo 1 · Nombre: El nombre del módulo es obligatorio',
      'Línea 2 · Cantidad: Cantidad > 0',
    ])
  })

  it('removes duplicated messages from repeated validation attempts', () => {
    expect(
      formatProposalValidationIssues([
        { path: ['title'], message: 'Required' },
        { path: ['title'], message: 'Required' },
      ]),
    ).toEqual(['Título: Required'])
  })
})
