import { describe, expect, it } from 'vitest'

import { POST } from './route'

describe('POST /share', () => {
  it('redirects shared content to the authenticated lead intake', async () => {
    const body = new URLSearchParams({
      title: 'Consulta desde LinkedIn',
      text: 'Quiere una app',
      url: 'https://linkedin.com/in/ana',
    })
    const response = await POST(
      new Request('https://app.doscientos.es/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }),
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(
      'https://app.doscientos.es/leads/new?shared_title=Consulta+desde+LinkedIn&shared_text=Quiere+una+app&shared_url=https%3A%2F%2Flinkedin.com%2Fin%2Fana',
    )
  })
})
