import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({ claimLead: vi.fn() }))
vi.mock('sileo', () => ({ sileo: { error: vi.fn() } }))
vi.mock('../../reminders/schedule-reminder-dialog', () => ({
  ScheduleReminderDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))
vi.mock('../lead-quick-action-dialogs', () => ({
  QCallDialog: () => <button type="button">Registrar llamada</button>,
  QWhatsAppDialog: () => <button type="button">Preparar WhatsApp</button>,
  QSendEmailDialog: () => <button type="button">Enviar email</button>,
  QEmailDialog: () => <button type="button">Registrar email</button>,
  QNoteDialog: () => <button type="button">Añadir nota</button>,
  QMeetNowDialog: () => <button type="button">Meet ahora</button>,
  QMeetDialog: () => <button type="button">Agendar reunión Meet</button>,
}))
vi.mock('./gmail-sync-button', () => ({
  GmailSyncButton: () => <button type="button">Sincronizar Gmail</button>,
}))
vi.mock('./extract-tasks-dialog', () => ({
  ExtractTasksDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))

import { LeadQuickActions } from './quick-actions'

const props = {
  leadId: 'lead-1',
  leadName: 'María López',
  leadEmail: 'maria@example.com',
  leadPhone: '600111222',
  senderName: 'Ana',
}

describe('LeadQuickActions', () => {
  it('keeps frequent actions visible and secondary actions collapsed', () => {
    render(<LeadQuickActions {...props} googleEnabled />)

    expect(screen.getByRole('button', { name: 'Registrar llamada' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Preparar WhatsApp' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Enviar email' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Agendar llamada' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Añadir nota' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Más acciones/ }))

    expect(screen.getByText('Registrar')).not.toBeNull()
    expect(screen.getByText('Reuniones')).not.toBeNull()
    expect(screen.getByText('Herramientas')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Añadir nota' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Sincronizar Gmail' })).not.toBeNull()
  })
})
