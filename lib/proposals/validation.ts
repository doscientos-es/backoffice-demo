import type { ZodIssue } from 'zod'

type ValidationIssue = Pick<ZodIssue, 'message' | 'path'>

const FIELD_LABELS: Record<string, string> = {
  acceptance_criteria: 'Criterios de aceptación',
  change_management_terms: 'Gestión de cambios',
  context_markdown: 'Contexto',
  deliverables: 'Entregables',
  notes: 'Notas',
  payment_schedule: 'Forma de pago',
  payment_terms: 'Condiciones de pago',
  scope_modules: 'Módulos de alcance',
  terms: 'Condiciones adicionales',
  title: 'Título',
  valid_until: 'Fecha de validez',
}

const NESTED_FIELD_LABELS: Record<string, string> = {
  description: 'Descripción',
  excluded: 'No incluido',
  included: 'Incluido',
  notes: 'Notas',
  quantity: 'Cantidad',
  title: 'Título',
  unit_price: 'Precio',
  vat_rate: 'IVA',
}

function issueLabel(path: ValidationIssue['path']): string {
  const [section, index, field] = path

  if (section === 'items') {
    if (typeof index === 'number') {
      return `Línea ${index + 1} · ${NESTED_FIELD_LABELS[String(field)] ?? 'Dato'}`
    }
    return 'Líneas de presupuesto'
  }

  if (section === 'scope_modules') {
    if (typeof index === 'number') {
      const label = field === 'title' ? 'Nombre' : (NESTED_FIELD_LABELS[String(field)] ?? 'Dato')
      return `Módulo ${index + 1} · ${label}`
    }
    return FIELD_LABELS.scope_modules ?? 'Módulos de alcance'
  }

  if (section === 'problems' || section === 'solutions') {
    const label = section === 'problems' ? 'Problema' : 'Solución'
    if (typeof index === 'number') {
      return `${label} ${index + 1} · ${NESTED_FIELD_LABELS[String(field)] ?? 'Dato'}`
    }
    return `${label}s`
  }

  return FIELD_LABELS[String(section)] ?? 'Datos de la propuesta'
}

/** Turns schema errors into labels that point to the affected proposal editor field. */
export function formatProposalValidationIssues(issues: readonly ValidationIssue[]): string[] {
  return [...new Set(issues.map((issue) => `${issueLabel(issue.path)}: ${issue.message}`))]
}
