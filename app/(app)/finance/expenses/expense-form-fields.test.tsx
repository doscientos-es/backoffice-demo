/**
 * Regression tests for ExpenseFormFields — the optional "Más detalles" block.
 *
 * Bug: the optional section used to be conditionally rendered
 * (`{showDetails && ...}`). When collapsed, its inputs were unmounted and thus
 * absent from the form's FormData. On edit, the server action reads missing
 * fields as "" and writes the columns to null, silently wiping data the user
 * never touched (e.g. due_date / paid_at / notes).
 *
 * Fix: keep the block always mounted and toggle visibility with CSS, so the
 * values are always present in FormData regardless of expand/collapse state.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ExpenseFormFields } from '@/app/(app)/finance/expenses/expense-form-fields'

function renderInForm(ui: React.ReactElement): HTMLFormElement {
  const { container } = render(<form>{ui}</form>)
  const form = container.querySelector('form')
  if (!form) throw new Error('form not rendered')
  return form
}

describe('ExpenseFormFields — optional fields survive collapse', () => {
  it('submits the selected project id from the searchable combobox', () => {
    const form = renderInForm(
      <ExpenseFormFields
        projects={[{ id: 'project-1', name: 'Web corporativa', clientName: 'Acme' }]}
        defaults={{ project_id: 'project-1' }}
      />,
    )

    expect(new FormData(form).get('project_id')).toBe('project-1')
    expect(screen.getByPlaceholderText('Buscar proyecto…')).toBeDefined()
  })

  it('keeps optional values in FormData after the user collapses the section', () => {
    const form = renderInForm(
      <ExpenseFormFields
        idPrefix="t"
        defaults={{
          vendor: 'Meta',
          subtotal: 100,
          tax_rate: 21,
          notes: 'Nota privada',
          invoice_reference: 'F-2025-001',
          due_date: '2025-01-15',
        }}
      />,
    )

    // Optional values present → section auto-expands and fields are filled.
    expect(new FormData(form).get('notes')).toBe('Nota privada')
    expect(new FormData(form).get('invoice_reference')).toBe('F-2025-001')
    expect(new FormData(form).get('due_date')).toBe('2025-01-15')

    // User collapses "Más detalles" before saving.
    fireEvent.click(screen.getByRole('button', { name: /Más detalles/i }))

    // The values must STILL be submitted — collapsing only hides via CSS.
    const fd = new FormData(form)
    expect(fd.get('notes')).toBe('Nota privada')
    expect(fd.get('invoice_reference')).toBe('F-2025-001')
    expect(fd.get('due_date')).toBe('2025-01-15')
  })

  it('submits optional fields even when the section starts collapsed', () => {
    // No optional values → section starts collapsed (showDetails = false).
    const form = renderInForm(
      <ExpenseFormFields idPrefix="c" defaults={{ vendor: 'Notion', subtotal: 9, tax_rate: 21 }} />,
    )

    // Section is collapsed, yet the optional controls are still in the DOM…
    expect(form.querySelector('[name="notes"]')).not.toBeNull()
    expect(form.querySelector('[name="invoice_reference"]')).not.toBeNull()
    expect(form.querySelector('[name="due_date"]')).not.toBeNull()

    // …so they are part of FormData (empty, but present — never undefined).
    const fd = new FormData(form)
    expect(fd.has('notes')).toBe(true)
    expect(fd.has('invoice_reference')).toBe(true)
    expect(fd.has('due_date')).toBe(true)
  })

  it('auto-expands the section when due_date is the only optional value', () => {
    renderInForm(
      <ExpenseFormFields
        idPrefix="d"
        defaults={{ vendor: 'AWS', subtotal: 50, tax_rate: 21, due_date: '2025-03-01' }}
      />,
    )

    // The collapse caret shows ▾ (expanded) so the user can see the due_date.
    expect(screen.getByRole('button', { name: /Más detalles/i }).textContent).toContain('▾')
  })
})
