import { formatInteractionForAI, type LeadInteractionForAI } from './interaction-utils'

type LeadContextRow = Record<string, unknown>

function display(value: unknown): string {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return '—'
  return String(value)
}

function yesNoUnknown(value: unknown): string {
  return value === true ? 'sí' : value === false ? 'no' : 'sin marcar'
}

function compact(values: unknown[]): string {
  return values.filter((value) => value != null && String(value).trim() !== '').join(' · ') || '—'
}

function companyResearchSummary(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '—'
  const research = value as Record<string, unknown>
  const services = Array.isArray(research.services) ? research.services.join(', ') : null
  const reasons = Array.isArray(research.reasons) ? research.reasons.join(' | ') : null
  const cautions = Array.isArray(research.cautions) ? research.cautions.join(' | ') : null
  return compact([
    research.description && `descripción: ${research.description}`,
    research.sector && `sector: ${research.sector}`,
    services && `servicios: ${services}`,
    research.fit && `encaje: ${research.fit}`,
    research.priority && `prioridad: ${research.priority}`,
    reasons && `señales: ${reasons}`,
    cautions && `cautelas: ${cautions}`,
  ])
}

/** Serializes the CRM fields that influence qualification and sales prioritization. */
export function formatLeadContextForAI(lead: LeadContextRow): string {
  return [
    `Nombre: ${display(lead.name)}`,
    `Alias: ${display(lead.alias)}`,
    `Empresa: ${display(lead.company)}`,
    `Email: ${display(lead.email)}`,
    `Teléfono: ${display(lead.phone)}`,
    `Origen: ${display(lead.source)}`,
    `Estado: ${display(lead.status)}`,
    `Valor estimado: ${display(lead.estimated_value)}`,
    `Score: ${display(lead.score)}`,
    `Notas: ${display(lead.notes)}`,
    `Cualificación: empresa ${display(lead.company_size)} · solución ${display(lead.solution_type)} · urgencia ${display(lead.urgency)}`,
    `Mom Test: problema real ${yesNoUnknown(lead.mom_test_real_problem)} · consciente ${yesNoUnknown(lead.mom_test_aware_problem)} · soluciones previas ${yesNoUnknown(lead.mom_test_tried_solutions)} · decisión/presupuesto ${yesNoUnknown(lead.mom_test_decision_power_or_budget)} · accesible ${yesNoUnknown(lead.mom_test_accessible)}`,
    `Primer contacto: ${display(lead.first_contacted_at)}`,
    `Conversión: ${compact([lead.conversion_step, lead.landing_subject])}`,
    `Landing: ${compact([lead.landing_path, lead.landing_ref])}`,
    `Atribución inicial: ${compact([lead.first_landing_path, lead.first_referrer, lead.first_utm_source, lead.first_utm_medium, lead.first_utm_campaign, lead.first_utm_term, lead.first_utm_content])}`,
    `Atribución última: ${compact([lead.last_landing_path, lead.last_referrer, lead.last_utm_source, lead.last_utm_medium, lead.last_utm_campaign, lead.last_utm_term, lead.last_utm_content])}`,
    `Calculadora: ${compact([lead.calculator_cost, lead.calculator_hours])}`,
    `Pérdida/no interés: ${compact([lead.lost_reason, lead.lost_at])}`,
    `Resumen IA anterior: ${display(lead.ai_summary)}`,
    `Siguiente paso IA anterior: ${display(lead.ai_suggested_next_step)} · fecha: ${display(lead.ai_suggested_next_step_at)}`,
    `Investigación pública de empresa (información inferida, revisar antes de usar): ${companyResearchSummary(lead.company_research)}`,
  ].join('\n')
}

export type ScheduledLeadTaskForAI = {
  title: string | null
  description: string | null
  start_at: string | null
  status: string | null
  priority: string | number | null
}

export function formatScheduledLeadTasksForAI(tasks: ScheduledLeadTaskForAI[]): string {
  return tasks
    .map(
      (task) =>
        `- ${display(task.start_at)} | ${display(task.title)} | estado: ${display(task.status)} | prioridad: ${display(task.priority)}${task.description ? ` | ${task.description.slice(0, 400)}` : ''}`,
    )
    .join('\n')
}

export type LeadProposalForAI = {
  number: string | null
  title: string | null
  status: string | null
  total: number | null
  valid_until: string | null
  sent_at: string | null
  viewed_at: string | null
  responded_at: string | null
  notes: string | null
}

export function formatLeadProposalsForAI(proposals: LeadProposalForAI[]): string {
  return proposals
    .map(
      (proposal) =>
        `- ${display(proposal.number)} | ${display(proposal.title)} | estado: ${display(proposal.status)} | total: ${display(proposal.total)} | válida hasta: ${display(proposal.valid_until)} | enviada: ${display(proposal.sent_at)} | vista: ${display(proposal.viewed_at)} | respondida: ${display(proposal.responded_at)}${proposal.notes ? ` | ${proposal.notes.slice(0, 500)}` : ''}`,
    )
    .join('\n')
}

export type LeadConversionEventForAI = {
  event_name: string
  conversion_step: string | null
  landing_path: string | null
  referrer: string | null
  utm_source: string | null
  utm_campaign: string | null
  created_at: string
}

export function formatLeadConversionEventsForAI(events: LeadConversionEventForAI[]): string {
  return events
    .map(
      (event) =>
        `- ${display(event.created_at)} | ${display(event.event_name)} | paso: ${display(event.conversion_step)} | landing: ${display(event.landing_path)} | ref: ${display(event.referrer)} | UTM: ${compact([event.utm_source, event.utm_campaign])}`,
    )
    .join('\n')
}

type LeadBriefingProject = {
  name: string
  status: string | null
  description: string | null
}

type LeadBriefingInvoice = {
  full_number: string | null
  status: string | null
  total: number | null
  issue_date: string | null
}

type LeadBriefingTask = {
  title: string
  status: string
  due_date: string | null
  description: string | null
  priority: string | null
}

type LeadBriefingReminder = {
  title: string
  remind_at: string
}

type LeadBriefingAttachment = {
  name: string
  mime_type: string | null
}

export type LeadBriefingForAI = {
  lead: LeadContextRow
  clientName: string | null
  interactions: LeadInteractionForAI[]
  proposals: LeadProposalForAI[]
  projects: LeadBriefingProject[]
  invoices: LeadBriefingInvoice[]
  tasks: LeadBriefingTask[]
  reminders: LeadBriefingReminder[]
  attachments: LeadBriefingAttachment[]
}

/**
 * Creates a portable CRM briefing for a third-party AI. It is deliberately
 * deterministic: copying it does not send CRM data anywhere.
 */
export function formatLeadBriefingForAI(context: LeadBriefingForAI): string {
  const interactions = context.interactions.slice().reverse().map(formatInteractionForAI).join('\n')
  const projects = context.projects
    .map(
      (project) =>
        `- ${display(project.name)} | estado: ${display(project.status)}${project.description ? ` | ${project.description.slice(0, 1000)}` : ''}`,
    )
    .join('\n')
  const invoices = context.invoices
    .map(
      (invoice) =>
        `- ${display(invoice.full_number)} | estado: ${display(invoice.status)} | total: ${display(invoice.total)} | emitida: ${display(invoice.issue_date)}`,
    )
    .join('\n')
  const tasks = context.tasks
    .map(
      (task) =>
        `- ${display(task.due_date)} | ${display(task.title)} | estado: ${display(task.status)} | prioridad: ${display(task.priority)}${task.description ? ` | ${task.description.slice(0, 700)}` : ''}`,
    )
    .join('\n')
  const reminders = context.reminders
    .map((reminder) => `- ${display(reminder.remind_at)} | ${display(reminder.title)}`)
    .join('\n')
  const attachments = context.attachments
    .map((attachment) => `- ${display(attachment.name)} | ${display(attachment.mime_type)}`)
    .join('\n')

  return [
    '# Briefing CRM para IA',
    'Usa únicamente estos datos como fuente de verdad. Si falta información, indícalo y no la inventes.',
    '\n## Ficha y cualificación del lead',
    formatLeadContextForAI(context.lead),
    `Cliente vinculado: ${display(context.clientName)}`,
    '\n## Historial de interacciones (cronológico)',
    interactions || '(sin interacciones registradas)',
    '\n## Actividad pendiente',
    `Tareas:\n${tasks || '(sin tareas registradas)'}\n\nRecordatorios:\n${reminders || '(sin recordatorios pendientes)'}`,
    '\n## Propuestas relacionadas',
    formatLeadProposalsForAI(context.proposals) || '(sin propuestas relacionadas)',
    '\n## Proyectos vinculados',
    projects || '(sin proyectos vinculados)',
    '\n## Facturación vinculada',
    invoices || '(sin facturas vinculadas)',
    '\n## Adjuntos registrados',
    `${attachments || '(sin adjuntos)'}\nNota: solo se incluyen los nombres y tipos de los archivos; su contenido no se ha extraído.`,
  ].join('\n')
}
