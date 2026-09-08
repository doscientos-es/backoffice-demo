import { z } from 'zod'

import { PortalToken } from './portal'

export const ProjectRequestCategory = z.enum([
  'incident',
  'change',
  'question',
  'material',
  'complaint',
  'maintenance',
])

export const SubmitProjectRequestInput = z.object({
  token: PortalToken,
  category: ProjectRequestCategory,
  subject: z.string().trim().min(1, 'Indica un asunto').max(160),
  body: z.string().trim().min(1, 'Describe la solicitud').max(4000),
  requesterName: z.string().trim().min(1, 'Indica tu nombre').max(160),
  requesterEmail: z
    .union([z.literal(''), z.string().trim().email('Email no válido').max(254)])
    .optional(),
  website: z.string().max(0).optional(),
})
