'use client'

import { Hand } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Purely presentational claim button.
 * The parent (UnassignedLeadsSection) owns the optimistic state and wires the
 * server action via `onClaimAction`.
 */
export function ClaimLeadButton({
  leadId,
  onClaimAction,
}: {
  leadId: string
  onClaimAction: (id: string) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      data-icon="inline-start"
      aria-label="Asignarme este lead"
      title="Asignármelo"
      onClick={() => onClaimAction(leadId)}
    >
      <Hand />
      Asignármelo
    </Button>
  )
}
