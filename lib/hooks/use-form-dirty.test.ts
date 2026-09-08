/**
 * Tests for useFormDirty — specifically the scenario where the form element
 * mounts lazily (e.g. inside a Dialog that starts closed). The previous
 * useRef+useEffect implementation failed in this case because the effect ran
 * once on component mount when formRef.current was still null, leaving
 * baseline unset and isDirty permanently false.
 */

import { describe, expect, it } from 'vitest'

import { snapshot } from '@/lib/hooks/use-form-dirty'

// ---------------------------------------------------------------------------
// snapshot() unit tests
// ---------------------------------------------------------------------------
describe('snapshot()', () => {
  function makeForm(fields: Record<string, string>): HTMLFormElement {
    const form = document.createElement('form')
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    return form
  }

  it('returns the same string for identical field values', () => {
    const form1 = makeForm({ tax_rate: '21', vendor: 'Meta' })
    const form2 = makeForm({ tax_rate: '21', vendor: 'Meta' })
    expect(snapshot(form1)).toBe(snapshot(form2))
  })

  it('detects a change from 21 to 0', () => {
    const form = makeForm({ tax_rate: '21' })
    const base = snapshot(form)
    // Simulate user changing IVA to 0
    ;(form.elements.namedItem('tax_rate') as HTMLInputElement).value = '0'
    expect(snapshot(form)).not.toBe(base)
  })

  it('detects a change from any value to empty string', () => {
    const form = makeForm({ subtotal: '100' })
    const base = snapshot(form)
    ;(form.elements.namedItem('subtotal') as HTMLInputElement).value = ''
    expect(snapshot(form)).not.toBe(base)
  })

  it('is order-independent (sorted by field name)', () => {
    const form1 = makeForm({ vendor: 'A', tax_rate: '21' })
    const form2 = makeForm({ tax_rate: '21', vendor: 'A' })
    expect(snapshot(form1)).toBe(snapshot(form2))
  })
})

// ---------------------------------------------------------------------------
// Regression: callback ref must work when form mounts AFTER hook init
// ---------------------------------------------------------------------------
import { act, renderHook } from '@testing-library/react'

import { useFormDirty } from '@/lib/hooks/use-form-dirty'

describe('useFormDirty — lazy form mount (dialog scenario)', () => {
  function makeForm(fields: Record<string, string> = {}): HTMLFormElement {
    const form = document.createElement('form')
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    return form
  }

  it('isDirty is false before any form is attached', () => {
    const { result } = renderHook(() => useFormDirty())
    expect(result.current.isDirty).toBe(false)
  })

  it('isDirty becomes true when a field value changes after late mount', () => {
    const { result } = renderHook(() => useFormDirty())

    const form = makeForm({ tax_rate: '21', vendor: 'Meta' })

    // Simulate dialog opening: form mounts and callback ref fires
    act(() => {
      result.current.formRef(form)
    })

    expect(result.current.isDirty).toBe(false)

    // Simulate user changing IVA from 21 → 0
    act(() => {
      ;(form.elements.namedItem('tax_rate') as HTMLInputElement).value = '0'
      form.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(result.current.isDirty).toBe(true)
  })

  it('isDirty stays false when value matches baseline (no real change)', () => {
    const { result } = renderHook(() => useFormDirty())
    const form = makeForm({ tax_rate: '21' })

    act(() => {
      result.current.formRef(form)
    })

    // Dispatch input without changing the value
    act(() => {
      form.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(result.current.isDirty).toBe(false)
  })

  it('reset() re-baselines so subsequent no-op changes are not dirty', () => {
    const { result } = renderHook(() => useFormDirty())
    const form = makeForm({ tax_rate: '21' })

    act(() => result.current.formRef(form))

    act(() => {
      ;(form.elements.namedItem('tax_rate') as HTMLInputElement).value = '0'
      form.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(result.current.isDirty).toBe(true)

    act(() => result.current.reset())
    expect(result.current.isDirty).toBe(false)

    // Further input without change should still be clean
    act(() => {
      form.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(result.current.isDirty).toBe(false)
  })

  it('re-captures baseline when form remounts (dialog reopen)', () => {
    const { result } = renderHook(() => useFormDirty())
    const form = makeForm({ tax_rate: '21' })

    act(() => result.current.formRef(form))

    // Change the value — isDirty = true
    act(() => {
      ;(form.elements.namedItem('tax_rate') as HTMLInputElement).value = '0'
      form.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(result.current.isDirty).toBe(true)

    // Simulate dialog closing (form unmounts) then reopening with fresh form
    act(() => result.current.formRef(null))
    const freshForm = makeForm({ tax_rate: '21' })
    act(() => result.current.formRef(freshForm))

    // After remount, no changes yet → not dirty
    expect(result.current.isDirty).toBe(false)
  })
})
