/**
 * Minimal, dependency-free markdown renderer.
 *
 * Supports the subset of markdown we actually emit (headings ##/###/####,
 * unordered lists with `-` or `*`, ordered lists, blockquotes, bold/italic,
 * inline code and paragraphs). Anything else falls back to a paragraph with
 * the original text — which is intentional: we never want to ship unknown
 * markup to the client portal.
 *
 * Reuse this for technical specs, proposal intro/terms and similar markdown
 * surfaces — there is no other markdown renderer in the codebase so adding a
 * dependency would be overkill.
 */

import type { ReactNode } from 'react'

import { cn } from '../lib/utils'

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g

function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let last = 0
  for (const m of line.matchAll(INLINE_RE)) {
    const start = m.index ?? 0
    if (start > last) tokens.push({ kind: 'text', value: line.slice(last, start) })
    const raw = m[0]
    if (raw.startsWith('**')) tokens.push({ kind: 'bold', value: raw.slice(2, -2) })
    else if (raw.startsWith('`')) tokens.push({ kind: 'code', value: raw.slice(1, -1) })
    else tokens.push({ kind: 'italic', value: raw.slice(1, -1) })
    last = start + raw.length
  }
  if (last < line.length) tokens.push({ kind: 'text', value: line.slice(last) })
  return tokens
}

function renderInline(line: string): ReactNode[] {
  return parseInline(line).map((t, i) => {
    const key = `${t.kind}-${i}`
    switch (t.kind) {
      case 'bold':
        return <strong key={key}>{t.value}</strong>
      case 'italic':
        return <em key={key}>{t.value}</em>
      case 'code':
        return (
          <code key={key} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
            {t.value}
          </code>
        )
      default:
        return <span key={key}>{t.value}</span>
    }
  })
}

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'p'; text: string }
  | { kind: 'hr' }

function tokenize(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const raw = lines[i] ?? ''
    const line = raw.trimEnd()
    if (line.trim() === '') {
      i++
      continue
    }
    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push({
        kind: 'heading',
        level: (h[1] ?? '').length as 1 | 2 | 3 | 4,
        text: h[2] ?? '',
      })
      i++
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }
    if (line.startsWith('> ')) {
      const qLines: string[] = []
      while (i < lines.length && (lines[i] ?? '').startsWith('> ')) {
        qLines.push((lines[i] ?? '').slice(2))
        i++
      }
      blocks.push({ kind: 'quote', lines: qLines })
      continue
    }
    const para: string[] = [line]
    i++
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{1,4}\s|[-*]\s|\d+\.\s|>\s|---+$)/.test(lines[i] ?? '')
    ) {
      para.push(lines[i] ?? '')
      i++
    }
    blocks.push({ kind: 'p', text: para.join(' ') })
  }
  return blocks
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = tokenize(source)
  return (
    <div
      className={cn(
        'prose-doscientos flex flex-col gap-4 text-sm leading-relaxed text-foreground',
        className,
      )}
    >
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading': {
            const sz =
              b.level === 1
                ? 'text-2xl'
                : b.level === 2
                  ? 'text-xl'
                  : b.level === 3
                    ? 'text-base'
                    : 'text-sm'
            const Tag = `h${b.level}` as 'h1' | 'h2' | 'h3' | 'h4'
            return (
              <Tag
                // biome-ignore lint/suspicious/noArrayIndexKey: blocks are fully recomputed from source on every render
                key={i}
                className={cn('font-semibold tracking-tight', sz, b.level <= 2 && 'mt-2')}
              >
                {renderInline(b.text)}
              </Tag>
            )
          }
          case 'ul':
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks are fully recomputed from source on every render
              <ul key={i} className="ml-5 list-disc space-y-1">
                {b.items.map((it, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: list items are fully recomputed from source on every render
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks are fully recomputed from source on every render
              <ol key={i} className="ml-5 list-decimal space-y-1">
                {b.items.map((it, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: list items are fully recomputed from source on every render
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            )
          case 'quote':
            return (
              <blockquote
                // biome-ignore lint/suspicious/noArrayIndexKey: blocks are fully recomputed from source on every render
                key={i}
                className="border-border text-muted-foreground border-l-2 pl-3 italic"
              >
                {b.lines.map((l, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: quote lines are fully recomputed from source on every render
                  <p key={j}>{renderInline(l)}</p>
                ))}
              </blockquote>
            )
          case 'hr':
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks are fully recomputed from source on every render
            return <hr key={i} className="border-border" />
          default:
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks are fully recomputed from source on every render
            return <p key={i}>{renderInline(b.text)}</p>
        }
      })}
    </div>
  )
}
