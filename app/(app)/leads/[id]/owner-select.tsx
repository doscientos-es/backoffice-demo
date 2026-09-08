'use client'

import { useState } from 'react'

import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Select } from '@/components/ui/select'
import type { MemberOption } from '@/lib/members/queries'

import { assignLeadOwner } from '../actions'

/**
 * Inline owner picker for the lead detail view. Persists immediately via
 * `assignLeadOwner` and surfaces optimistic feedback. The empty option
 * clears the owner ("" → null in the schema).
 *
 * Uses controlled `value` so the select reflects the saved state even when
 * Next.js revalidates without unmounting the component.
 */
export function LeadOwnerSelect({
  leadId,
  assignedTo,
  members,
}: {
  leadId: string
  assignedTo: string | null
  members: MemberOption[]
}) {
  const feedback = useFormFeedback()
  const [value, setValue] = useState(assignedTo ?? '')

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        disabled={feedback.pending}
        className="h-8 w-48"
        aria-label="Responsable del lead"
        onChange={async (e) => {
          const next = e.target.value
          setValue(next)
          feedback.setPending()
          const res = await assignLeadOwner({ leadId, assigneeId: next })
          if (!res.ok) {
            setValue(assignedTo ?? '') // revert on error
            feedback.setError(res.error)
          } else {
            feedback.setSuccess('Responsable actualizado')
          }
        }}
      >
        <option value="">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>
      <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
    </div>
  )
}
