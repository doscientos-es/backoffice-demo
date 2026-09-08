import demoData from '../../data/demo-data.json'

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

// biome-ignore lint/suspicious/noExplicitAny: JSON rows are intentionally schema-flexible.
type Row = Record<string, any>
type LocalError = { message: string; code?: string }
// biome-ignore lint/suspicious/noExplicitAny: cloned feature views consume different JSON shapes.
type ListResult = { data: any[]; error: LocalError | null; count: number }
// biome-ignore lint/suspicious/noExplicitAny: a single local row is shape-flexible.
type SingleResult = { data: any | null; error: LocalError | null; count: number }
// biome-ignore lint/suspicious/noExplicitAny: procedure results can be scalar, row, or list.
type ProcedureResult = { data: any; error: LocalError | null }
type Filter = (row: Row) => boolean

const tables = demoData as Record<string, Row[]>
const clone = <T>(value: T): T => structuredClone(value)

class LocalQuery implements PromiseLike<ListResult> {
  private filters: Filter[] = []
  private maxRows: number | null = null
  private slice: [number, number] | null = null
  private sort: { field: string; ascending: boolean } | null = null
  private head = false
  private inserted: Row[] | null = null

  constructor(private readonly table: string) {}

  select(_columns = '*', options?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }) { this.head = options?.head ?? false; return this }
  eq(field: string, value: unknown) { return this.where((row) => row[field] === value) }
  neq(field: string, value: unknown) { return this.where((row) => row[field] !== value) }
  is(field: string, value: unknown) { return this.where((row) => row[field] === value) }
  in(field: string, values: readonly unknown[]) { return this.where((row) => values.includes(row[field])) }
  gt(field: string, value: unknown) { return this.compare(field, value, (a, b) => a > b) }
  gte(field: string, value: unknown) { return this.compare(field, value, (a, b) => a >= b) }
  lt(field: string, value: unknown) { return this.compare(field, value, (a, b) => a < b) }
  lte(field: string, value: unknown) { return this.compare(field, value, (a, b) => a <= b) }
  like(_field: string, _pattern: string) { return this }
  ilike(_field: string, _pattern: string) { return this }
  or(_filters: string, _options?: { foreignTable?: string }) { return this }
  not(_field: string, _operator: string, _value: unknown) { return this }
  contains(_field: string, _value: unknown) { return this }
  containedBy(_field: string, _value: unknown) { return this }
  overlaps(_field: string, _value: unknown) { return this }
  textSearch(_field: string, _query: string) { return this }
  filter(_field: string, _operator: string, _value: unknown) { return this }
  abortSignal(_signal: AbortSignal) { return this }
  throwOnError() { return this }
  match(values: Row) { for (const [field, value] of Object.entries(values)) this.eq(field, value); return this }
  insert(values: Row | Row[]) { this.inserted = Array.isArray(values) ? values : [values]; return this }
  upsert(values: Row | Row[], _options?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.inserted = Array.isArray(values) ? values : [values]; return this }
  update(_values: Row) { return this }
  delete() { return this }
  limit(value: number) { this.maxRows = value; return this }
  range(from: number, to: number) { this.slice = [from, to]; return this }
  order(field: string, options?: { ascending?: boolean; nullsFirst?: boolean }) { this.sort = { field, ascending: options?.ascending ?? true }; return this }
  single(): Promise<SingleResult> { return this.resolveSingle() }
  maybeSingle(): Promise<SingleResult> { return this.resolveSingle() }
  then<TResult1 = ListResult, TResult2 = never>(onfulfilled?: ((value: ListResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return this.resolveList().then(onfulfilled, onrejected) }

  private where(filter: Filter) { this.filters.push(filter); return this }
  private compare(field: string, value: unknown, compare: (left: string, right: string) => boolean) { return this.where((row) => compare(String(row[field] ?? ''), String(value ?? ''))) }
  private rows(): { rows: Row[]; count: number } {
    let rows = clone(this.inserted ?? tables[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)))
    const count = rows.length
    if (this.sort) rows.sort((left, right) => String(left[this.sort!.field] ?? '').localeCompare(String(right[this.sort!.field] ?? '')) * (this.sort!.ascending ? 1 : -1))
    if (this.slice) rows = rows.slice(this.slice[0], this.slice[1] + 1)
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows)
    return { rows: this.head ? [] : rows, count }
  }

  private async resolveList(): Promise<ListResult> {
    const { rows, count } = this.rows()
    return { data: rows, error: null, count }
  }

  private async resolveSingle(): Promise<SingleResult> {
    const { rows, count } = this.rows()
    return { data: rows[0] ?? null, error: null, count }
  }
}

const demoUser = { id: DEMO_USER_ID, email: 'marta@demo.invalid', user_metadata: { name: 'Marta Demo' } }

// The cloned application still has many data access call sites. This facade
// deliberately keeps integration-only namespaces flexible, while query rows
// remain JSON records so existing list views retain contextual typing.
// biome-ignore lint/suspicious/noExplicitAny: compatibility boundary for cloned integrations
type IntegrationStub = any

type LocalAuth = {
  getUser: () => Promise<IntegrationStub>
  getSession: () => Promise<{ data: { session: { access_token: string } | null }; error: LocalError | null }>
  signOut: () => Promise<IntegrationStub>
  signInWithPassword: (credentials: unknown) => Promise<IntegrationStub>
  signInWithOAuth: (options: unknown) => Promise<IntegrationStub>
  verifyOtp: (options: unknown) => Promise<IntegrationStub>
  mfa: {
    getAuthenticatorAssuranceLevel: (accessToken?: string) => Promise<IntegrationStub>
    listFactors: () => Promise<{ data: { totp: Array<{ id: string; status: string }> }; error: LocalError | null }>
    [key: string]: IntegrationStub
  }
  admin: {
    listUsers: (options?: unknown) => Promise<{ data: { users: Array<{ id: string; last_sign_in_at: string | null; confirmed_at: string | null }> }; error: LocalError | null }>
    [key: string]: IntegrationStub
  }
  [key: string]: IntegrationStub
}

type LocalChannel = {
  on: (event: string, filter: unknown, callback: (payload: IntegrationStub) => void) => LocalChannel
  subscribe: () => LocalChannel
  unsubscribe: () => Promise<'ok'>
}

export type LocalDataClient = {
  auth: LocalAuth
  from: (table: string) => LocalQuery
  rpc: (name: string, args?: Row) => PromiseLike<ProcedureResult>
  channel: (name: string) => LocalChannel
  removeChannel: IntegrationStub
  removeAllChannels: IntegrationStub
  getChannels: IntegrationStub
  storage: IntegrationStub
  functions: IntegrationStub
}

export function createLocalDataClient(): LocalDataClient {
  const channel: LocalChannel = { on: () => channel, subscribe: () => channel, unsubscribe: async () => 'ok' }
  return {
    auth: { getUser: async () => ({ data: { user: demoUser }, error: null }), getSession: async () => ({ data: { session: { access_token: 'demo-local-session' } }, error: null }), signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: { user: demoUser, session: null }, error: null }), signInWithOAuth: async () => ({ data: { provider: 'demo', url: null }, error: null }), verifyOtp: async () => ({ error: null }), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }), listFactors: async () => ({ data: { totp: [] }, error: null }) }, admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
    from: (table) => new LocalQuery(table), rpc: async () => ({ data: null, error: null }), channel: () => channel,
    removeChannel: async () => 'ok', removeAllChannels: async () => [], getChannels: () => [],
    storage: { from: () => ({ upload: async () => ({ data: null, error: null }), remove: async () => ({ data: [], error: null }), download: async () => ({ data: null, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }), createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }), list: async () => ({ data: [], error: null }) }) },
    functions: { invoke: async () => ({ data: null, error: { message: 'Función no disponible en la demo' } }) },
  }
}