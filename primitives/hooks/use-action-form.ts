'use client'

import type { FormEvent } from 'react'
import { type FormFeedbackState, useFormFeedback } from '@doscientos/ui'

import type { ActionFailure, ActionResult } from '../lib/types'

/**
 * A server action invoked from a client form. It receives the form's
 * `FormData` and either returns an {@link ActionResult} (validation / domain
 * outcome) or never resolves normally because it `redirect()`s.
 */
type ActionFn = (formData: FormData) => Promise<ActionResult | undefined>

interface UseActionFormOptions {
  /**
   * Feedback shown when the action succeeds without navigating away. Omit for
   * redirecting actions (the page changes before any message would be seen).
   */
  successMessage?: string
  /**
   * Runs after a successful, non-redirecting submit. Receives the form element
   * captured synchronously, so it stays valid across the `await`.
   */
  onSuccess?: (form: HTMLFormElement) => void
  /** Return true when the caller has shown a specialized failure UI. */
  onFailure?: (result: ActionFailure) => boolean | undefined
}

export interface UseActionFormResult {
  /** Feedback state to drive `<FormFeedback />` (or a custom error banner). */
  state: FormFeedbackState
  pending: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>
  /** Reset feedback to idle (e.g. when a dialog closes). */
  reset: () => void
}

/**
 * Centralizes the submit lifecycle shared by every client form that calls a
 * server action: prevent default, snapshot `FormData`, flip to pending, then
 * surface the error or success.
 */
export function useActionForm(
  action: ActionFn,
  options: UseActionFormOptions = {},
): UseActionFormResult {
  const feedback = useFormFeedback()

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    feedback.setPending()
    const res = await action(new FormData(form))
    if (res && !res.ok) {
      if (options.onFailure?.(res)) return
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess(options.successMessage)
    options.onSuccess?.(form)
  }

  return {
    state: feedback.state,
    pending: feedback.pending,
    onSubmit,
    reset: feedback.reset,
  }
}
