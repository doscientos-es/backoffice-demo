// @vitest-environment node

import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { extractPdfPages } from './pdf-text'

describe('extractPdfPages', () => {
  it('extracts page-aware native text without OCR', async () => {
    const bytes = await readFile('docs/diagnostico-lead-ejemplo.pdf')
    const result = await extractPdfPages(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    )

    expect(result.pageCount).toBeGreaterThan(0)
    expect(result.pages).not.toHaveLength(0)
    expect(result.pages[0]?.pageNumber).toBe(1)
    expect(result.pages.some((page) => page.content.length > 100)).toBe(true)
    expect(result.truncated).toBe(false)
  })
})
