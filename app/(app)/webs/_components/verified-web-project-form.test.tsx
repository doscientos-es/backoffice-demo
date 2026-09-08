import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateWebProject, verifyWithPasskey } = vi.hoisted(() => ({
  updateWebProject: vi.fn(),
  verifyWithPasskey: vi.fn(),
}))

vi.mock('@/components/security/use-passkey-verification', () => ({
  usePasskeyVerification: () => ({ challenge: null, verifyWithPasskey }),
}))
vi.mock('@/components/ui/form-feedback', () => ({
  FormFeedback: () => null,
  useFormFeedback: () => ({
    pending: false,
    setError: vi.fn(),
    setPending: vi.fn(),
    state: { status: 'idle' },
  }),
}))
vi.mock('@/components/ui/submit-button', () => ({
  SubmitButton: ({ children }: { children: React.ReactNode }) => (
    <button type="submit">{children}</button>
  ),
}))
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../actions', () => ({ createWebProject: vi.fn(), updateWebProject }))
vi.mock('./web-form-fields', () => ({
  WebFormFields: ({ defaults = {} }: { defaults?: Record<string, unknown> }) => (
    <>
      <input name="name" defaultValue={(defaults.name as string) ?? 'Web'} />
      <input name="db_host" aria-label="Host" defaultValue={(defaults.db_host as string) ?? ''} />
      <input name="db_port" defaultValue={(defaults.db_port as number) ?? ''} />
      <input name="db_name" defaultValue={(defaults.db_name as string) ?? ''} />
      <input name="db_user" defaultValue={(defaults.db_user as string) ?? ''} />
      <input name="db_pass" type="password" />
    </>
  ),
}))

import { VerifiedWebProjectForm } from './verified-web-project-form'

describe('VerifiedWebProjectForm', () => {
  const defaults = {
    name: 'Web actual',
    db_host: 'db.example.test',
    db_port: 5432,
    db_name: 'app',
    db_user: 'postgres',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    verifyWithPasskey.mockResolvedValue({ ok: true })
    updateWebProject.mockResolvedValue({ ok: true })
  })

  it('saves routine metadata edits without interrupting with biometrics', async () => {
    render(
      <VerifiedWebProjectForm
        clients={[]}
        projects={[]}
        mode="edit"
        projectId="web-1"
        defaults={defaults}
      />,
    )

    fireEvent.change(screen.getByDisplayValue('Web actual'), { target: { value: 'Nuevo nombre' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateWebProject).toHaveBeenCalledOnce())
    expect(verifyWithPasskey).not.toHaveBeenCalled()
  })

  it('requires verification when database credentials change', async () => {
    render(
      <VerifiedWebProjectForm
        clients={[]}
        projects={[]}
        mode="edit"
        projectId="web-1"
        defaults={defaults}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Host' }), {
      target: { value: 'new-db.example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(verifyWithPasskey).toHaveBeenCalledWith({
        intent: 'web.db_credentials.update',
        resource: 'web:web-1',
      }),
    )
    await waitFor(() => expect(updateWebProject).toHaveBeenCalledOnce())
  })
})
