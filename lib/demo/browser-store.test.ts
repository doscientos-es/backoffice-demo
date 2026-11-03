import { describe, expect, it } from 'vitest'

import { createBrowserDemoStore, type DemoDatabase, type DemoStorage } from './browser-store'

function memoryStorage(): DemoStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

const seed: DemoDatabase = { clients: [{ id: '1', name: 'Cliente ficticio' }] }

describe('browser demo store', () => {
  it('persists changes across store instances without changing the seed', () => {
    const storage = memoryStorage()
    const first = createBrowserDemoStore(storage, seed)
    first.update((draft) => {
      draft.clients?.push({ id: '2', name: 'Nuevo cliente' })
    })

    const second = createBrowserDemoStore(storage, seed)
    expect(second.read().clients).toHaveLength(2)
    expect(seed.clients).toHaveLength(1)
  })

  it('does not persist mutations to returned snapshots', () => {
    const store = createBrowserDemoStore(memoryStorage(), seed)
    const snapshot = store.update((draft) => { draft.clients?.push({ id: '2' }) })
    snapshot.clients?.push({ id: '3' })
    store.read().clients?.push({ id: '4' })

    expect(store.read().clients).toHaveLength(2)
  })

  it('restores the seed when reset', () => {
    const store = createBrowserDemoStore(memoryStorage(), seed)
    store.update((draft) => { draft.clients = [] })
    expect(store.reset()).toEqual(seed)
    expect(store.read()).toEqual(seed)
  })

  it('does not overwrite corrupted data without an explicit reset', () => {
    const storage = memoryStorage()
    storage.setItem('doscientos:backoffice-demo:v1', '{invalid')
    const store = createBrowserDemoStore(storage, seed)

    expect(() => store.update(() => {})).toThrow('datos locales de la demo están dañados')
    expect(storage.getItem('doscientos:backoffice-demo:v1')).toBe('{invalid')
    expect(store.reset()).toEqual(seed)
  })

  it('surfaces storage errors instead of claiming that a change was saved', () => {
    const storage = memoryStorage()
    storage.setItem = () => { throw new Error('quota exceeded') }
    const store = createBrowserDemoStore(storage, seed)

    expect(() => store.update((draft) => { draft.clients = [] })).toThrow('quota exceeded')
    expect(store.read()).toEqual(seed)
  })
})