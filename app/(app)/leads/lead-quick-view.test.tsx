import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../reminders/schedule-reminder-dialog', () => ({
  ScheduleReminderDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))
vi.mock('../tasks/actions', () => ({ createTask: vi.fn() }))
vi.mock('./[id]/extract-tasks-dialog', () => ({
  ExtractTasksDialog: () => <button type="button">Extraer tareas IA</button>,
}))
vi.mock('./[id]/gmail-sync-button', () => ({
  GmailSyncButton: () => <button type="button">Sincronizar Gmail</button>,
}))
vi.mock('./lead-quick-action-dialogs', () => ({
  QCallDialog: () => <button type="button">Registrar llamada</button>,
  QWhatsAppDialog: () => <button type="button">Preparar WhatsApp</button>,
  QSendEmailDialog: () => <button type="button">Enviar email</button>,
  QEmailDialog: () => <button type="button">Registrar email</button>,
  QNoteDialog: () => <button type="button">Añadir nota</button>,
  QMeetNowDialog: () => <button type="button">Meet ahora</button>,
  QMeetDialog: () => <button type="button">Agendar reunión Meet</button>,
}))

import { DrawerQuickActions } from './lead-quick-view'

describe('DrawerQuickActions', () => {
  it('shows every detailed-view action inside the expandable section', () => {
    render(
      <DrawerQuickActions
        leadId="lead-1"
        leadName="María López"
        leadEmail="maria@example.com"
        leadPhone="600 111 222"
        senderName="Ana"
        aiEnabled
        googleEnabled
      />,
    )

    expect(screen.queryByRole('button', { name: 'Enviar email' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Más acciones/ }))

    for (const name of [
      'Enviar email',
      'Registrar email',
      'Añadir nota',
      'Meet ahora',
      'Agendar reunión Meet',
      'Sincronizar Gmail',
      'Extraer tareas IA',
    ]) {
      expect(screen.getByRole('button', { name })).not.toBeNull()
    }
  })
})
