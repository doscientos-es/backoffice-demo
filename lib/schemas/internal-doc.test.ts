import { describe, expect, it } from 'vitest'

import {
  INTERNAL_DOC_ACTIONS,
  INTERNAL_DOC_CATEGORIES,
  INTERNAL_DOC_MAX_SIZE_BYTES,
  INTERNAL_DOC_MAX_TAG_LENGTH,
  INTERNAL_DOC_MAX_TAGS,
  INTERNAL_DOC_VISIBILITIES,
  InternalDocCategorySchema,
  InternalDocIdInput,
  InternalDocVisibilitySchema,
  UpdateInternalDocInput,
} from '@/lib/schemas/internal-doc'

const uuid = '11111111-1111-1111-1111-111111111111'

describe('internal-doc constants & enums', () => {
  it('expose catalogue arrays and limits', () => {
    expect(INTERNAL_DOC_CATEGORIES).toContain('legal')
    expect(INTERNAL_DOC_VISIBILITIES).toEqual(['all_team', 'admins_only'])
    expect(INTERNAL_DOC_ACTIONS).toContain('file_replaced')
    expect(INTERNAL_DOC_MAX_SIZE_BYTES).toBe(50 * 1024 * 1024)
    expect(INTERNAL_DOC_MAX_TAGS).toBe(20)
    expect(INTERNAL_DOC_MAX_TAG_LENGTH).toBe(40)
    expect(InternalDocCategorySchema.safeParse('hr').success).toBe(true)
    expect(InternalDocVisibilitySchema.safeParse('admins_only').success).toBe(true)
  })
})

describe('UpdateInternalDocInput', () => {
  const valid = {
    id: uuid,
    name: 'Política',
    category: 'policies' as const,
    visibility: 'all_team' as const,
  }

  it('defaults tags to an empty array', () => {
    const out = UpdateInternalDocInput.parse(valid)
    expect(out.tags).toEqual([])
  })
  it('trims and accepts tags within limits', () => {
    const out = UpdateInternalDocInput.parse({ ...valid, tags: [' urgente '] })
    expect(out.tags).toEqual(['urgente'])
  })
  it('rejects too many tags', () => {
    const tags = Array.from({ length: INTERNAL_DOC_MAX_TAGS + 1 }, (_, i) => `t${i}`)
    expect(UpdateInternalDocInput.safeParse({ ...valid, tags }).success).toBe(false)
  })
  it('requires a name and a valid id', () => {
    expect(UpdateInternalDocInput.safeParse({ ...valid, name: '' }).success).toBe(false)
    expect(UpdateInternalDocInput.safeParse({ ...valid, id: 'x' }).success).toBe(false)
  })
})

describe('InternalDocIdInput', () => {
  it('validates the uuid payload', () => {
    expect(InternalDocIdInput.safeParse({ id: uuid }).success).toBe(true)
  })
})
