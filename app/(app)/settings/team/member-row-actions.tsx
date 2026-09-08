'use client'

import { useRouter } from 'next/navigation'

import { usePasskeyVerification } from '@/components/security/use-passkey-verification'
import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Select } from '@/components/ui/select'
import type { MemberRole } from '@/lib/auth'
import { userVerificationScope } from '@/lib/security/user-verification-scope'

import {
  deactivateMember,
  deleteMember,
  reactivateMember,
  resendInvite,
  toggleLeadsAssignable,
  updateMemberRole,
} from './actions'

interface Props {
  memberId: string
  memberEmail: string
  role: MemberRole
  isSelf: boolean
  isDeactivated: boolean
  isPending: boolean
  actorRole: MemberRole
  leadsAssignable: boolean
}

export function MemberRowActions({
  memberId,
  memberEmail,
  role,
  isSelf,
  isDeactivated,
  isPending,
  actorRole,
  leadsAssignable,
}: Props) {
  const feedback = useFormFeedback()
  const router = useRouter()
  const { challenge, verifyWithPasskey } = usePasskeyVerification()
  const canEditOwner = actorRole === 'owner'
  const targetIsOwner = role === 'owner'
  const disabledRoleSelect = isSelf || isDeactivated || (targetIsOwner && !canEditOwner)
  const canDelete = actorRole === 'owner' && isDeactivated && !isSelf
  const canEditLeads = (actorRole === 'owner' || actorRole === 'admin') && !isDeactivated

  async function onRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as MemberRole
    if (next === role) return
    feedback.setPending()
    const verification = await verifyWithPasskey(
      userVerificationScope('team.member.role.update', `member:${memberId}:role:${next}`),
    )
    if (!verification.ok) {
      feedback.setError(verification.error)
      e.target.value = role
      return
    }
    const res = await updateMemberRole({ memberId, role: next })
    if (!res.ok) {
      feedback.setError(res.error)
      e.target.value = role
      return
    }
    feedback.setSuccess('Rol actualizado')
    router.refresh()
  }

  async function onToggleActive() {
    feedback.setPending()
    if (!isDeactivated) {
      const verification = await verifyWithPasskey(
        userVerificationScope('team.member.deactivate', `member:${memberId}`),
      )
      if (!verification.ok) {
        feedback.setError(verification.error)
        return
      }
    }
    const res = isDeactivated
      ? await reactivateMember({ memberId })
      : await deactivateMember({ memberId })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess(isDeactivated ? 'Reactivado' : 'Desactivado')
    router.refresh()
  }

  async function onDelete() {
    const confirmed = window.confirm(
      `Eliminar permanentemente a ${memberEmail}?\n\nEsta acción no se puede deshacer. El email quedará libre para futuras invitaciones.`,
    )
    if (!confirmed) return
    feedback.setPending()
    const verification = await verifyWithPasskey(
      userVerificationScope('team.member.delete', `member:${memberId}`),
    )
    if (!verification.ok) {
      feedback.setError(verification.error)
      return
    }
    const res = await deleteMember({ memberId })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess('Eliminado')
    router.refresh()
  }

  async function onResendInvite() {
    feedback.setPending()
    const res = await resendInvite({ memberId })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess('Invitación reenviada')
  }

  async function onToggleLeadsAssignable() {
    feedback.setPending()
    const res = await toggleLeadsAssignable({ memberId, leadsAssignable: !leadsAssignable })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess(leadsAssignable ? 'Excluido de leads' : 'Incluido en leads')
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {challenge}
      <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
      {canEditLeads ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={feedback.pending}
          onClick={onToggleLeadsAssignable}
          title={
            leadsAssignable
              ? 'Excluir del reparto automático de leads'
              : 'Incluir en el reparto automático de leads'
          }
        >
          {leadsAssignable ? 'Leads: sí' : 'Leads: no'}
        </Button>
      ) : null}
      {isPending ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={feedback.pending}
          onClick={onResendInvite}
        >
          Reenviar
        </Button>
      ) : null}
      <Select
        defaultValue={role}
        disabled={disabledRoleSelect || feedback.pending}
        className="h-8 w-36"
        onChange={onRoleChange}
        aria-label="Rol"
      >
        {canEditOwner ? <option value="owner">Propietario</option> : null}
        <option value="admin">Administrador</option>
        <option value="member">Miembro</option>
        <option value="viewer">Solo lectura</option>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isSelf || feedback.pending || (targetIsOwner && !canEditOwner)}
        onClick={onToggleActive}
      >
        {isDeactivated ? 'Reactivar' : 'Desactivar'}
      </Button>
      {canDelete ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={feedback.pending}
          onClick={onDelete}
        >
          Eliminar
        </Button>
      ) : null}
    </div>
  )
}
