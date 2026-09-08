import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WebFormFields } from './web-form-fields'

const clientId = '11111111-1111-1111-1111-111111111111'
const projectId = '22222222-2222-2222-2222-222222222222'

const clients = [{ id: clientId, name: 'Acme' }]
const projects = [{ id: projectId, name: 'Web de Acme', client_id: clientId }]

function getSelect(id: string) {
  return document.getElementById(id) as HTMLSelectElement
}

describe('WebFormFields project link', () => {
  it('preselects a project, its client and portal visibility', () => {
    render(
      <WebFormFields
        clients={clients}
        projects={projects}
        defaults={{ project_id: projectId, client_id: clientId, is_client_visible: true }}
      />,
    )

    expect(getSelect('web-project_id').value).toBe(projectId)
    expect(getSelect('web-client_id').value).toBe(clientId)
    expect((document.getElementById('web-is_client_visible') as HTMLInputElement).checked).toBe(
      true,
    )
  })

  it('links the matching client and enables portal visibility when a project is selected', () => {
    render(<WebFormFields clients={clients} projects={projects} />)

    fireEvent.change(getSelect('web-project_id'), { target: { value: projectId } })

    expect(getSelect('web-client_id').value).toBe(clientId)
    expect((document.getElementById('web-is_client_visible') as HTMLInputElement).checked).toBe(
      true,
    )
  })
})
