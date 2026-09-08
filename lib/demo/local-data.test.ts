import { describe, expect, it } from 'vitest'

import { createLocalDataClient } from './local-data'

describe('local demo data', () => {
  it('reads a fixture row from the versioned JSON dataset', async () => {
    const client = createLocalDataClient()
    const { data, error } = await client
      .from('clients')
      .select('id, name')
      .eq('id', '10000000-0000-4000-8000-000000000001')
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toMatchObject({ name: 'Prisma Foods' })
  })

  it('does not persist simulated updates', async () => {
    const client = createLocalDataClient()
    await client.from('clients').update({ name: 'No persistido' }).eq('id', '10000000-0000-4000-8000-000000000001')

    const { data } = await client.from('clients').select('name').eq('id', '10000000-0000-4000-8000-000000000001').maybeSingle()
    expect(data?.name).toBe('Prisma Foods')
  })
})