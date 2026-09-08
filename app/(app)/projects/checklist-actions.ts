'use server'

import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { uuidIdInput } from '@/lib/schemas/common'
import { createServerClient } from '@/lib/supabase/server'

const ChecklistItemInput = z.object({
  project_id: z.string().uuid(),
  label: z.string().min(1, 'El texto es obligatorio').max(300),
})

const ToggleInput = z.object({
  id: z.string().uuid(),
  is_done: z.coerce.boolean(),
})

export const addChecklistItem = defineAction({
  name: 'checklist.add',
  schema: ChecklistItemInput,
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data: maxRow } = await supabase
      .from('project_checklist_items')
      .select('position')
      .eq('project_id', input.project_id)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextPosition = ((maxRow as { position: number } | null)?.position ?? 0) + 1

    const { error } = await supabase.from('project_checklist_items').insert({
      project_id: input.project_id,
      label: input.label,
      position: nextPosition,
    })
    if (error) throw new Error(error.message)
  },
  revalidate: (_p, input) => [`/projects/${input.project_id}`],
})

export const toggleChecklistItem = defineAction({
  name: 'checklist.toggle',
  schema: ToggleInput,
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('project_checklist_items')
      .update({ is_done: input.is_done, done_at: input.is_done ? new Date().toISOString() : null })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  },
})

export const deleteChecklistItem = defineAction({
  name: 'checklist.delete',
  schema: uuidIdInput,
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('project_checklist_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  },
})
