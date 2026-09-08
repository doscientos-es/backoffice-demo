import { z } from 'zod'

import { parseGithubRepoUrl } from '../integrations/github-sync'
import { emptyToUndef, optionalText, requiredText } from './common'

/**
 * Zod schemas for the `projects` domain.
 */

export const ProjectStatus = z.enum(['planning', 'active', 'on_hold', 'done', 'cancelled'])
export type ProjectStatusType = z.infer<typeof ProjectStatus>

export const GithubSyncMode = z.enum(['none', 'link_only', 'bidirectional'])
export type GithubSyncModeType = z.infer<typeof GithubSyncMode>

export const ProjectWorkspacePath = z
  .string()
  .trim()
  .min(1, 'La ruta no puede estar vacía')
  .max(240, 'La ruta es demasiado larga')
  .superRefine((path, ctx) => {
    const unsafe =
      path.includes('\\') ||
      path.startsWith('/') ||
      path.startsWith('~') ||
      path.endsWith('/') ||
      path.includes('//') ||
      /^[A-Za-z]:/.test(path) ||
      path.split('/').some((segment) => segment === '.' || segment === '..')
    if (unsafe && path !== '.') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Usa una ruta relativa a la raíz del repositorio, sin '..' ni barras invertidas",
      })
    }
  })

export const UpdateProjectWorkspacePathsInput = z.object({
  id: z.string().uuid('ID de proyecto inválido'),
  expected_version: z.coerce.number().int().positive(),
  workspace_paths: z
    .array(ProjectWorkspacePath)
    .max(20, 'No puedes asociar más de 20 rutas')
    .transform((paths) => [...new Set(paths)]),
})

/** Fixed-price vs. hourly engagement. Drives monthly invoice generation. */
export const ProjectBillingType = z.enum(['fixed', 'hourly'])
export type ProjectBillingTypeType = z.infer<typeof ProjectBillingType>

const ProjectBase = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  name: requiredText(160, 'El nombre es obligatorio'),
  /** Template to clone as onboarding checklist (only used on create). */
  template_id: z.string().uuid().optional().or(emptyToUndef),
  description: optionalText(4000),
  status: ProjectStatus.default('planning'),

  // --- Billing model ---
  billing_type: ProjectBillingType.default('fixed'),
  /** €/h applied when generating an hourly project's monthly invoice. */
  hourly_rate: z
    .union([z.coerce.number().positive('La tarifa debe ser > 0'), emptyToUndef])
    .optional(),
  /** VAT (%) for hourly invoices. 0 for projects sin impuestos (e.g. Palumba). */
  hourly_vat_rate: z.coerce.number().min(0).max(100).default(21),

  // --- GitHub integration ---
  github_sync_mode: GithubSyncMode.default('none'),
  github_auto_sync: z.coerce.boolean().default(true),
  github_repo: z.string().url('URL inválida').optional().or(emptyToUndef),
  github_installation_id: z.union([z.coerce.number().int().positive(), emptyToUndef]).optional(),
  github_repo_id: z.union([z.coerce.number().int().positive(), emptyToUndef]).optional(),
  github_last_sync: z.string().optional().or(emptyToUndef),

  // --- Date range ---
  starts_at: z.string().optional().or(emptyToUndef),
  ends_at: z.string().optional().or(emptyToUndef),
})

const projectRefinement = (d: z.infer<typeof ProjectBase>, ctx: z.RefinementCtx) => {
  if (d.billing_type === 'hourly' && !d.hourly_rate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hourly_rate'],
      message: 'Indica la tarifa por hora para un proyecto facturado por horas.',
    })
  }

  if (d.github_sync_mode === 'none') return

  if (!d.github_repo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['github_repo'],
      message: 'Indica la URL del repositorio.',
    })
    return
  }
  const parsed = parseGithubRepoUrl(d.github_repo)
  if (!parsed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['github_repo'],
      message: 'URL no válida. Formato: https://github.com/owner/repo',
    })
    return
  }
  if (d.github_sync_mode === 'bidirectional' && !d.github_installation_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['github_installation_id'],
      message: 'Se necesita el Installation ID de la GitHub App para sync bidireccional.',
    })
  }
}

export const ProjectInput = ProjectBase.superRefine(projectRefinement)

export type ProjectInputType = z.infer<typeof ProjectInput>

export const UpdateProjectInput = ProjectBase.extend({
  id: z.string().uuid('ID de proyecto inválido'),
  expected_version: z.coerce.number().int().positive(),
}).superRefine(projectRefinement)

export type UpdateProjectInputType = z.infer<typeof UpdateProjectInput>
