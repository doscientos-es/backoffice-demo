/**
 * High-level helpers built on top of `lib/integrations/github` that:
 *   • Know about our `projects.github_sync_mode` contract.
 *   • Are safe to call fire-and-forget from server actions (errors logged, not thrown).
 *   • Persist the GitHub link + `github_synced_at` back to the row.
 *
 * Only `bidirectional` projects with `github_auto_sync = true` are eligible.
 */

import { createAdminClient } from '@/lib/supabase/admin'

import {
  createGitHubBranchFromDefault,
  createGitHubIssue,
  issueBranchName,
  updateGitHubIssueState,
} from './github'

export type GitHubSyncMode = 'none' | 'link_only' | 'bidirectional'

/**
 * Parse a GitHub repo URL into `{ owner, name }`. Accepts:
 *   https://github.com/<owner>/<repo>
 *   https://github.com/<owner>/<repo>.git
 *   https://github.com/<owner>/<repo>/...
 */
export function parseGithubRepoUrl(url: string): { owner: string; name: string } | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/.?#]+)(?:\.git)?(?:[/?#].*)?$/i)
  if (!match?.[1] || !match[2]) return null
  return { owner: match[1], name: match[2] }
}

interface ProjectSyncRow {
  id: string
  github_sync_mode: GitHubSyncMode
  github_auto_sync: boolean
  github_repo_owner: string | null
  github_repo_name: string | null
  github_installation_id: number | null
}

async function loadEligibleProject(projectId: string): Promise<ProjectSyncRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projects')
    .select(
      'id, github_sync_mode, github_auto_sync, github_repo_owner, github_repo_name, github_installation_id',
    )
    .eq('id', projectId)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as ProjectSyncRow
  if (row.github_sync_mode !== 'bidirectional') return null
  if (!row.github_auto_sync) return null
  if (!row.github_repo_owner || !row.github_repo_name || !row.github_installation_id) return null
  return row
}

/**
 * Auto-create a GitHub issue for a task, assign it to the task's assignee (if they
 * have a github_handle), and create a feature branch off the default branch.
 * Non-blocking: failures are logged and swallowed. Returns true on success.
 */
export async function autoSyncTaskIssue(taskId: string, projectId: string): Promise<boolean> {
  try {
    const project = await loadEligibleProject(projectId)
    if (!project) return false

    const admin = createAdminClient()

    const { data: task } = await admin
      .from('tasks')
      .select('id, title, description, assignee_id, github_issue_number')
      .eq('id', taskId)
      .maybeSingle()
    if (!task || task.github_issue_number) return false

    // Resolve github_handle for the assignee
    let assigneeHandle: string | undefined
    if (task.assignee_id) {
      const { data: member } = await admin
        .from('team_members')
        .select('github_handle')
        .eq('id', task.assignee_id as string)
        .maybeSingle()
      if (member?.github_handle) assigneeHandle = member.github_handle as string
    }

    const owner = project.github_repo_owner as string
    const repo = project.github_repo_name as string
    const installationId = project.github_installation_id as number
    const title = task.title as string

    const issue = await createGitHubIssue({
      installationId,
      owner,
      repo,
      title,
      body: (task.description as string | null) ?? '',
      assignees: assigneeHandle ? [assigneeHandle] : [],
    })

    // Create feature branch — non-fatal if it fails (e.g. duplicate, no push access)
    let branchName: string | null = null
    try {
      branchName = await createGitHubBranchFromDefault({
        installationId,
        owner,
        repo,
        branchName: issueBranchName(issue.number, title),
      })
    } catch (branchErr) {
      console.warn('[github-sync] branch creation skipped', { taskId, err: branchErr })
    }

    const now = new Date().toISOString()
    await admin
      .from('tasks')
      .update({
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
        github_synced_at: now,
        ...(branchName ? { github_branch: branchName } : {}),
      })
      .eq('id', taskId)
    await admin.from('projects').update({ github_synced_at: now }).eq('id', project.id)
    return true
  } catch (err) {
    console.error('[github-sync] autoSyncTaskIssue failed', { taskId, projectId, err })
    return false
  }
}

/**
 * Syncs a task's status change back to its linked GitHub issue.
 * - done / cancelled  → closes the issue
 * - any other status  → reopens the issue
 *
 * Only runs for bidirectional projects with auto-sync enabled and a linked issue.
 * Fire-and-forget safe: errors are logged, never thrown.
 */
export async function syncTaskStatusToGitHub(taskId: string, newStatus: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data: task } = await admin
      .from('tasks')
      .select('github_issue_number, project_id')
      .eq('id', taskId)
      .maybeSingle()

    if (!task?.github_issue_number || !task?.project_id) return false

    const project = await loadEligibleProject(task.project_id as string)
    if (!project) return false

    const state = newStatus === 'done' || newStatus === 'cancelled' ? 'closed' : 'open'
    await updateGitHubIssueState(
      project.github_installation_id as number,
      project.github_repo_owner as string,
      project.github_repo_name as string,
      task.github_issue_number as number,
      state,
    )

    await admin
      .from('tasks')
      .update({ github_synced_at: new Date().toISOString() })
      .eq('id', taskId)
    return true
  } catch (err) {
    console.error('[github-sync] syncTaskStatusToGitHub failed', { taskId, newStatus, err })
    return false
  }
}
