import { describe, expect, it } from 'vitest'

import { buildBackofficeBackupPayload, getBackofficeBackupSetup } from './backoffice'

describe('backoffice backup setup', () => {
  it('is explicitly unavailable in the local demo', () => {
    const setup = getBackofficeBackupSetup()
    expect(setup.configured).toBe(false)
    expect(setup.missing).toEqual(['Demo local: no se configuran backups remotos'])
  })

  it('describes a local-only, unavailable backup capability', () => {
    const setup = getBackofficeBackupSetup()
    expect(buildBackofficeBackupPayload(setup)).toMatchObject({
      clientSlug: 'doscientos-backoffice',
      mode: 'local-demo',
      available: false,
    })
  })
})
