/**
 * Single source of truth for per-domain status metadata (label + badge variant)
 * used across listings, detail pages and the public portal.
 *
 * Centralising these maps eliminates 17+ duplicated `STATUS_VARIANT` /
 * `STATUS_LABEL` declarations and prevents silent drift between the team-facing
 * UI and the client-facing portal (e.g. `proposal.sent` was rendered as
 * "Enviada" in one place and "Pendiente" in another).
 */

import type { VariantProps } from 'class-variance-authority'

import type { badgeVariants } from '@/components/ui/badge'
import { EXPENSE_STATUS_LABELS, type ExpenseStatus } from '@/lib/finance'
import type { RecoveryState } from '@/lib/recovery/types'

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export type StatusEntry = { label: string; variant: BadgeVariant }
export type StatusMeta<T extends string> = Readonly<Record<T, StatusEntry>>

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'

export const INVOICE_STATUS: StatusMeta<InvoiceStatus> = {
  draft: { label: 'Borrador', variant: 'neutral' },
  issued: { label: 'Emitida', variant: 'info' },
  paid: { label: 'Pagada', variant: 'success' },
  overdue: { label: 'Vencida', variant: 'danger' },
  cancelled: { label: 'Anulada', variant: 'danger' },
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

export const PROPOSAL_STATUS: StatusMeta<ProposalStatus> = {
  draft: { label: 'Borrador', variant: 'neutral' },
  sent: { label: 'Enviada', variant: 'info' },
  viewed: { label: 'Vista', variant: 'warning' },
  accepted: { label: 'Aceptada', variant: 'success' },
  rejected: { label: 'Rechazada', variant: 'danger' },
  expired: { label: 'Expirada', variant: 'danger' },
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
/**
 * `qualifying` is legacy: it was split into the factual `contacted` /
 * `in_conversation` stages. It stays in the union because the Postgres enum
 * still carries the value and historical rows reference it.
 */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'in_conversation'
  | 'qualifying'
  | 'quoted'
  | 'won'
  | 'lost'
  | 'not_interested'
  | 'archived'

export const LEAD_STATUS: StatusMeta<LeadStatus> = {
  new: { label: 'Nuevo', variant: 'info' },
  contacted: { label: 'Contactado', variant: 'info' },
  in_conversation: { label: 'En conversación', variant: 'warning' },
  qualifying: { label: 'En conversación', variant: 'warning' },
  quoted: { label: 'Presupuestado', variant: 'warning' },
  won: { label: 'Ganado', variant: 'success' },
  lost: { label: 'Perdido', variant: 'danger' },
  not_interested: { label: 'No interesa', variant: 'neutral' },
  archived: { label: 'Archivado', variant: 'neutral' },
}

// ---------------------------------------------------------------------------
// Recovery (re-engagement funnel for lost leads). Ordered pending → engaged;
// the type lives in `lib/recovery/types` and is mirrored here for the badge.
// ---------------------------------------------------------------------------
export const RECOVERY_STATE: StatusMeta<RecoveryState> = {
  pending: { label: 'Sin contactar', variant: 'neutral' },
  contacted: { label: 'Contactado', variant: 'info' },
  opened: { label: 'Abierto', variant: 'warning' },
  engaged: { label: 'Interesado', variant: 'success' },
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'done' | 'cancelled'

/** Project states that can be selected when scheduling a lead meeting. */
export const MEETING_PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
] as const satisfies readonly ProjectStatus[]

export const PROJECT_STATUS: StatusMeta<ProjectStatus> = {
  planning: { label: 'Planificación', variant: 'info' },
  active: { label: 'Activo', variant: 'success' },
  on_hold: { label: 'En pausa', variant: 'warning' },
  done: { label: 'Finalizado', variant: 'info' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'

export const TASK_STATUS: StatusMeta<TaskStatus> = {
  todo: { label: 'Por hacer', variant: 'neutral' },
  in_progress: { label: 'En curso', variant: 'info' },
  in_review: { label: 'Revisión', variant: 'warning' },
  done: { label: 'Terminada', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export const TASK_PRIORITY: StatusMeta<TaskPriority> = {
  low: { label: 'Baja', variant: 'neutral' },
  medium: { label: 'Media', variant: 'info' },
  high: { label: 'Alta', variant: 'warning' },
  urgent: { label: 'Urgente', variant: 'danger' },
}

// ---------------------------------------------------------------------------
// Verifactu (AEAT submission state)
// ---------------------------------------------------------------------------
export type VerifactuStatus =
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'error'
  | 'excluded'

export const VERIFACTU_STATUS: StatusMeta<VerifactuStatus> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  submitted: { label: 'Enviada', variant: 'info' },
  accepted: { label: 'Aceptada', variant: 'success' },
  rejected: { label: 'Rechazada', variant: 'danger' },
  error: { label: 'Error técnico', variant: 'danger' },
  excluded: { label: 'Excluida', variant: 'neutral' },
}

/**
 * Narrower set used by the dashboard `AvisosPanel` — only states that warrant
 * surfacing as a pending issue.
 */
export type VerifactuAlertStatus = 'pending' | 'error' | 'rejected'

export const VERIFACTU_ALERT_STATUS: StatusMeta<VerifactuAlertStatus> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
  rejected: { label: 'Rechazada', variant: 'danger' },
}

// ---------------------------------------------------------------------------
// Expenses (labels live in `lib/finance` alongside the rest of the EXPENSE_*
// catalogue — we only own the badge variant mapping here)
// ---------------------------------------------------------------------------
export const EXPENSE_STATUS: StatusMeta<ExpenseStatus> = {
  pending: { label: EXPENSE_STATUS_LABELS.pending, variant: 'info' },
  paid: { label: EXPENSE_STATUS_LABELS.paid, variant: 'success' },
  cancelled: { label: EXPENSE_STATUS_LABELS.cancelled, variant: 'neutral' },
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export const SUBSCRIPTION_STATUS: StatusMeta<SubscriptionStatus> = {
  active: { label: 'Activa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  cancelled: { label: 'Cancelada', variant: 'danger' },
}

export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'yearly'

export const SUBSCRIPTION_BILLING_CYCLE: Record<SubscriptionBillingCycle, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

// ---------------------------------------------------------------------------
// Social Hub (post aggregate + per-network target lifecycle). Values mirror
// lib/social/core `PostStatus` / `TargetStatus`; kept here so badges stay
// consistent with the rest of the app.
// ---------------------------------------------------------------------------
export type SocialPostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partially_failed'
  | 'failed'

export const SOCIAL_POST_STATUS: StatusMeta<SocialPostStatus> = {
  draft: { label: 'Borrador', variant: 'neutral' },
  scheduled: { label: 'Programado', variant: 'info' },
  publishing: { label: 'Publicando', variant: 'warning' },
  published: { label: 'Publicado', variant: 'success' },
  partially_failed: { label: 'Parcial', variant: 'warning' },
  failed: { label: 'Fallido', variant: 'danger' },
}

export type SocialTargetStatus = 'pending' | 'publishing' | 'published' | 'failed'

export const SOCIAL_TARGET_STATUS: StatusMeta<SocialTargetStatus> = {
  pending: { label: 'Pendiente', variant: 'neutral' },
  publishing: { label: 'Publicando', variant: 'warning' },
  published: { label: 'Publicado', variant: 'success' },
  failed: { label: 'Fallido', variant: 'danger' },
}
