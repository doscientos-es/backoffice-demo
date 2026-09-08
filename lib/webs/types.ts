export type WebProjectListItem = {
  id: string
  name: string
  url: string
  client_id: string | null
  client_name: string | null
  project_id: string | null
  project_name: string | null
  is_client_visible: boolean
  is_own: boolean
  hosting_provider: string | null
  domain_expires_at: string | null
  tech_stack: string[]
  updated_at: string | null
}

export type WebProjectDetail = {
  id: string
  name: string
  url: string
  client_id: string | null
  project_id: string | null
  project_name: string | null
  is_client_visible: boolean
  is_own: boolean
  hosting_provider: string | null
  hosting_url: string | null
  domain_registrar: string | null
  domain_expires_at: string | null
  tech_stack: string[]
  notes: string | null
  backup_slug: string | null
  /** DB connection metadata for automated backups (password never exposed). */
  db_host: string | null
  db_port: number | null
  db_name: string | null
  db_user: string | null
  /** True when an encrypted DB password is stored; the value itself is never sent to the client. */
  has_db_password: boolean
  updated_at: string | null
}

export type OgMetadata = {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  type: string | null
  ogUrl: string | null
  twitterCard: string | null
  twitterTitle: string | null
  twitterImage: string | null
  canonical: string | null
  favicon: string | null
}

export type SiteStatus = {
  ok: boolean
  status: number | null
  latencyMs: number | null
  error: string | null
}
