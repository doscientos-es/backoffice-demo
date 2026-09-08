import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))

vi.mock('ai', () => ({
  generateText,
  Output: { object: vi.fn(() => ({ name: 'object' })) },
}))
vi.mock('@ai-sdk/google-vertex', () => ({
  createVertex: () => () => ({ modelId: 'test-model' }),
}))
vi.mock('./env', () => ({ isAIEnabled: () => true }))
vi.mock('./logger', () => ({ scopedLogger: () => ({ info: vi.fn() }) }))

import { runAIObject } from './ai'

const schema = z.object({ title: z.string() })
const input = {
  model: 'test-model',
  system: 'Devuelve un objeto JSON.',
  user: 'Prepara un borrador.',
  schema,
}

describe('runAIObject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AI_PROVIDER', 'vertex')
  })

  it('retries once when the provider returns malformed JSON', async () => {
    generateText
      .mockRejectedValueOnce(new SyntaxError('JSON.parse: unexpected character at line 1 column 1'))
      .mockResolvedValueOnce({ output: { title: 'Borrador válido' }, usage: undefined })

    await expect(runAIObject(input)).resolves.toEqual({ title: 'Borrador válido' })
    expect(generateText).toHaveBeenCalledTimes(2)
    expect(generateText.mock.calls[1]?.[0].system).toContain(
      'exclusivamente con un objeto JSON válido',
    )
  })

  it('retries when the provider finishes without structured output', async () => {
    const noOutputError = new Error('No output generated.')
    noOutputError.name = 'AI_NoOutputGeneratedError'
    generateText
      .mockRejectedValueOnce(noOutputError)
      .mockResolvedValueOnce({ output: { title: 'Borrador válido' }, usage: undefined })

    await expect(runAIObject(input)).resolves.toEqual({ title: 'Borrador válido' })
    expect(generateText).toHaveBeenCalledTimes(2)
  })

  it('hides JSON parsing details when the retry also fails', async () => {
    generateText.mockRejectedValue(
      new SyntaxError('JSON.parse: unexpected character at line 1 column 1'),
    )

    await expect(runAIObject(input)).rejects.toThrow(
      'La IA devolvió un resultado con un formato no válido. Inténtalo de nuevo.',
    )
  })
})
