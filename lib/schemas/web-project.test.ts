import { describe, expect, it } from 'vitest'

import { WebProjectInput } from './web-project'

const projectId = '11111111-1111-1111-1111-111111111111'

describe('WebProjectInput project link', () => {
  it('keeps the project optional for standalone web inventory entries', () => {
    const parsed = WebProjectInput.parse({ name: 'Web corporativa', url: 'https://example.test' })

    expect(parsed.project_id).toBeUndefined()
    expect(parsed.is_client_visible).toBe(false)
  })

  it('accepts a linked web that is visible in the project portal', () => {
    const parsed = WebProjectInput.parse({
      name: 'Sitio de prueba',
      url: 'https://sitio.example.test',
      project_id: projectId,
      is_client_visible: 'on',
    })

    expect(parsed.project_id).toBe(projectId)
    expect(parsed.is_client_visible).toBe(true)
  })
})
