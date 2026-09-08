/** Normalize human-entered keywords consistently across webhook and UI paths. */
export function normalizeAutomationText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Match a whole word/phrase, avoiding false positives such as `doscientosx`. */
export function matchesAutomationKeyword(text: string, keyword: string): boolean {
  const normalizedText = normalizeAutomationText(text)
  const normalizedKeyword = normalizeAutomationText(keyword)
  if (!normalizedText || !normalizedKeyword) return false

  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(normalizedText)
}

export function selectMatchingRule<T extends { postId: string | null; keyword: string }>(
  rules: T[],
  postId: string,
  text: string,
): T | null {
  return (
    rules
      .filter((rule) => matchesAutomationKeyword(text, rule.keyword))
      .sort((a, b) => Number(b.postId === postId) - Number(a.postId === postId))[0] ?? null
  )
}
