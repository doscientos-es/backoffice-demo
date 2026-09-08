/**
 * Returns the complete assignment list while keeping the legacy primary
 * assignee visible for tasks created before task_members was introduced.
 */
export function mergeTaskMemberIds(
  primaryId: string | null | undefined,
  memberIds: readonly (string | null | undefined)[],
): string[] {
  return [...new Set([primaryId, ...memberIds].filter((id): id is string => Boolean(id)))]
}

/**
 * Normalises creation assignments: the creator is the primary member when the
 * form does not submit an explicit selection; otherwise preserve selection
 * order so the first member remains the primary assignee.
 */
export function normalizeTaskMemberIds(creatorId: string, memberIds: readonly string[]): string[] {
  return [...new Set(memberIds.length > 0 ? memberIds : [creatorId])]
}
