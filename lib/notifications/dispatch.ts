import { type PushPayload, sendWebPushToMembers } from '@/lib/push/web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationEvent =
  | 'lead_new'
  | 'lead_assigned'
  | 'lead_uncontacted'
  | 'lead_stale'
  | 'lead_at_risk'
  | 'lead_follow_up_summary'
  | 'call_pending'
  | 'task_comment'
  | 'task_mention'
  | 'task_assigned'
  | 'daily_responsibilities'
  | 'invoice_paid'
  | 'invoice_payment'
  | 'invoice_requested'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'proposal_question'
  | 'proposal_deck_completed'

const TITLES: Record<NotificationEvent, string> = {
  lead_new: '🔔 Nuevo lead',
  lead_assigned: '👤 Lead asignado',
  lead_uncontacted: '⏱️ Lead sin contactar',
  lead_stale: '⚠️ Lead sin novedades',
  lead_at_risk: '🚨 Lead en riesgo',
  lead_follow_up_summary: '📋 Leads pendientes',
  call_pending: '📞 Llamada pendiente',
  task_comment: '💬 Nuevo comentario',
  task_mention: '💬 Te han mencionado',
  task_assigned: '✅ Tarea asignada',
  daily_responsibilities: '📋 Tu resumen diario',
  invoice_paid: '💰 Factura cobrada',
  invoice_payment: '💰 Pago recibido',
  invoice_requested: '🧾 Solicitud de facturación',
  proposal_accepted: '✅ Propuesta aceptada',
  proposal_rejected: '❌ Propuesta rechazada',
  proposal_question: '💬 Consulta sobre propuesta',
  proposal_deck_completed: '👀 Propuesta visualizada',
}

type DispatchInput = {
  recipientIds: string[]
  actorId?: string | null
  eventType: NotificationEvent
  entityType: string
  entityId: string
  body: string
  link?: string | null
  actions?: PushPayload['actions']
  data?: PushPayload['data']
}

export async function dispatchNotifications(input: DispatchInput): Promise<void> {
  const recipientIds = [...new Set(input.recipientIds)].filter((id) => id !== input.actorId)
  if (!recipientIds.length) return

  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert(
    recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      body: input.body,
      link: input.link ?? null,
    })),
  )
  if (error) return

  await Promise.all(
    recipientIds.map(async (recipientId) => {
      const { count } = await admin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', recipientId)
        .is('read_at', null)
      await sendWebPushToMembers([recipientId], {
        title: TITLES[input.eventType],
        body: input.body,
        url: input.link ?? '/',
        tag: `${input.eventType}-${input.entityId}`,
        badge: count ?? 1,
        actions: input.actions,
        data: { url: input.link ?? '/', ...input.data },
      })
    }),
  )
}
