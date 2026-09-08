import { z } from 'zod'

import { optionalDate, optionalText, optionalUuid } from '@/lib/schemas/common'

export const HOSTING_PROVIDERS = [
  'vercel',
  'netlify',
  'cloudflare',
  'hetzner',
  'aws',
  'digitalocean',
  'render',
  'railway',
  'wordpress',
  'other',
] as const

export type HostingProvider = (typeof HOSTING_PROVIDERS)[number]

export const HOSTING_PROVIDER_LABELS: Record<HostingProvider, string> = {
  vercel: 'Vercel',
  netlify: 'Netlify',
  cloudflare: 'Cloudflare Pages',
  hetzner: 'Hetzner',
  aws: 'AWS',
  digitalocean: 'DigitalOcean',
  render: 'Render',
  railway: 'Railway',
  wordpress: 'WordPress.com',
  other: 'Otro',
}

const optionalUrl = z
  .string()
  .url('URL no válida')
  .max(2000)
  .optional()
  .or(z.literal('').transform(() => undefined))

export const WebProjectInput = z.object({
  name: z.string().min(1, 'Nombre obligatorio').max(200).trim(),
  url: z.string().url('URL no válida').max(2000),
  client_id: optionalUuid,
  project_id: optionalUuid,
  is_client_visible: z
    .string()
    .optional()
    .transform((v) => v === 'on' || v === 'true')
    .or(z.boolean()),
  is_own: z
    .string()
    .optional()
    .transform((v) => v === 'on' || v === 'true')
    .or(z.boolean()),
  hosting_provider: optionalText(100),
  hosting_url: optionalUrl,
  domain_registrar: optionalText(200),
  domain_expires_at: optionalDate,
  /** Comma-separated string from the form → string[] in the DB. */
  tech_stack: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    ),
  notes: optionalText(4000),
  /** FileBrowser folder name for this site's backups (e.g. "optinergia"). */
  backup_slug: optionalText(200),
  // ── DB connection for automated backups ──────────────────────────────────
  db_host: optionalText(255),
  db_port: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(65535).optional()),
  db_name: optionalText(255),
  db_user: optionalText(255),
  /** Plaintext from the form. Encrypted with AES-256-GCM before persisting. */
  db_pass: optionalText(500),
})

export type WebProjectInputType = z.infer<typeof WebProjectInput>

export const UpdateWebProjectInput = WebProjectInput.extend({
  id: z.string().uuid(),
})

export type UpdateWebProjectInputType = z.infer<typeof UpdateWebProjectInput>
