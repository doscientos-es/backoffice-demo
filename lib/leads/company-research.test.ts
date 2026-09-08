import { describe, expect, it } from 'vitest'

import { corporateDomainFromEmail, extractCompanyPage } from './company-research'

describe('corporateDomainFromEmail', () => {
  it('accepts corporate domains and excludes common personal inboxes', () => {
    expect(corporateDomainFromEmail('ana@acme.es')).toBe('acme.es')
    expect(corporateDomainFromEmail('ana@gmail.com')).toBeNull()
    expect(corporateDomainFromEmail('not-an-email')).toBeNull()
  })
})

describe('extractCompanyPage', () => {
  it('returns a compact, text-only source for the AI', () => {
    const source = extractCompanyPage(
      '<html><head><title>Acme &amp; Co</title><script>ignore()</script></head><body><h1>Software industrial</h1><p>Fabricamos soluciones.</p></body></html>',
      'https://acme.es',
      'Página principal',
    )
    expect(source).toMatchObject({ title: 'Acme & Co', url: 'https://acme.es' })
    expect(source.excerpt).toContain('Software industrial')
    expect(source.excerpt).not.toContain('ignore')
  })
})
