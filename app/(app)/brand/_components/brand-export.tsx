'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import type { BrandAsset } from './assets-grid'
import type { BrandToken } from './token-edit-dialog'

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return { copied, copy }
}

function CopyBlock({ label, content, lang }: { label: string; content: string; lang: string }) {
  const { copied, copy } = useCopy(content)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <pre className="bg-secondary text-foreground max-h-64 overflow-x-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
        <code className={`language-${lang}`}>{content}</code>
      </pre>
    </div>
  )
}

function buildCssVars(tokens: BrandToken[]) {
  const lines = tokens.map((t) => `  --${t.key}: ${t.value};`)
  return `:root {\n${lines.join('\n')}\n}`
}

function buildTheme(tokens: BrandToken[]) {
  const lines = tokens.flatMap((t) => {
    if (t.token_group === 'color') return [`  --color-${t.key}: var(--${t.key});`]
    if (t.token_group === 'radius') {
      return [
        `  --radius: var(--${t.key});`,
        `  --radius-sm: calc(var(--${t.key}) * 0.6);`,
        `  --radius-md: calc(var(--${t.key}) * 0.8);`,
        `  --radius-lg: var(--${t.key});`,
        `  --radius-xl: calc(var(--${t.key}) * 1.4);`,
        `  --radius-2xl: calc(var(--${t.key}) * 1.8);`,
        `  --radius-3xl: calc(var(--${t.key}) * 2.2);`,
        `  --radius-4xl: calc(var(--${t.key}) * 2.6);`,
      ]
    }
    return [`  --${t.key}: ${t.value};`]
  })
  return `@theme inline {\n${lines.join('\n')}\n}`
}

function buildJson(tokens: BrandToken[]) {
  const obj: Record<string, Record<string, string>> = {}
  for (const t of tokens) {
    if (!obj[t.token_group]) obj[t.token_group] = {}
    obj[t.token_group]![t.key] = t.value
  }
  return JSON.stringify(obj, null, 2)
}

function buildAiBrief(tokens: BrandToken[], assets: BrandAsset[]) {
  const colors = tokens.filter((t) => t.token_group === 'color')
  const typo = tokens.filter((t) => t.token_group === 'typography')
  const radii = tokens.filter((t) => t.token_group === 'radius')
  const logoAssets = assets.filter((a) => ['logo', 'isotipo'].includes(a.category))

  const colorRows = colors
    .map((t) => `| --${t.key} | \`${t.value}\` | ${t.description ?? ''} |`)
    .join('\n')
  const typoRows = typo.map((t) => `- **${t.key}**: \`${t.value}\``).join('\n')
  const radiusRows = radii.map((t) => `- **${t.key}**: \`${t.value}\``).join('\n')
  const assetRows = logoAssets
    .map((a) => `- **${a.name}** (${a.category}): ${a.public_url}`)
    .join('\n')

  const radiusScale = radii
    .map(
      (t) => `  --radius: var(--${t.key});
  --radius-sm: calc(var(--${t.key}) * 0.6);
  --radius-md: calc(var(--${t.key}) * 0.8);
  --radius-lg: var(--${t.key});
  --radius-xl: calc(var(--${t.key}) * 1.4);
  --radius-2xl: calc(var(--${t.key}) * 1.8);`,
    )
    .join('\n')

  return `# Guía de marca – doscientos

Aplica estos tokens en todos los proyectos web para mantener coherencia de marca.

## Colores

| Token | Valor | Uso |
|-------|-------|-----|
${colorRows}

## Tipografía

${typoRows || '- Sin tokens de tipografía definidos'}

## Radios

${radiusRows || '- Sin tokens de radio definidos'}

## Logos y assets

${assetRows || '- Sin assets de marca subidos aún'}

## Aplicación en Tailwind v4

Añade en \`globals.css\`:

\`\`\`css
@theme inline {
${colors.map((t) => `  --color-${t.key}: var(--${t.key});`).join('\n')}
${radiusScale}
}
\`\`\`

## CSS custom properties

\`\`\`css
:root {
${tokens.map((t) => `  --${t.key}: ${t.value};`).join('\n')}
}
\`\`\`
`
}

export function BrandExport({ tokens, assets }: { tokens: BrandToken[]; assets: BrandAsset[] }) {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground text-sm">
        Copia cualquier formato y pégalo directamente en tu proyecto o en un agente de IA.
      </p>
      <CopyBlock label="CSS custom properties (:root)" content={buildCssVars(tokens)} lang="css" />
      <CopyBlock label="Tailwind v4 @theme" content={buildTheme(tokens)} lang="css" />
      <CopyBlock label="JSON Design Tokens" content={buildJson(tokens)} lang="json" />
      <CopyBlock
        label="Brief de marca para agentes IA (Markdown)"
        content={buildAiBrief(tokens, assets)}
        lang="markdown"
      />
    </div>
  )
}
