/**
 * POST /api/github/webhook
 *
 * Receives GitHub App webhook events and syncs them to the CRM.
 * Validates X-Hub-Signature-256 before processing any payload.
 *
 * Handled events (sec. 19.3 of description.md):
 *   issues.opened / closed / reopened / assigned / labeled
 *   issue_comment.created
 *   pull_request.opened / closed (with merged flag)
 */

import { type NextRequest, NextResponse } from 'next/server'

import { verifyGitHubSignature } from '@/lib/integrations/github'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Types — minimal shapes we care about from GitHub payloads
// ---------------------------------------------------------------------------

interface GitHubUser {
  login: string
}

interface GitHubLabel {
  name: string
}

interface GitHubIssuePayload {
  action: string
  installation?: { id: number }
  repository?: { owner: { login: string }; name: string }
  issue: {
    number: number
    html_url: string
    title: string
    body?: string
    state: string
    assignee?: GitHubUser | null
    labels: GitHubLabel[]
  }
  assignee?: GitHubUser | null
  comment?: { id: number; body: string; user: GitHubUser }
  sender: GitHubUser
}

interface GitHubPRPayload {
  action: string
  pull_request: {
    number: number
    html_url: string
    state: string
    merged: boolean
    body?: string
    user: GitHubUser
  }
  repository?: { owner: { login: string }; name: string }
  sender: GitHubUser
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifyGitHubSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const event = req.headers.get('x-github-event') ?? ''
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    if (event === 'issues' || event === 'issue_comment') {
      await handleIssueEvent(supabase, event, payload as GitHubIssuePayload)
    } else if (event === 'pull_request') {
      await handlePREvent(supabase, payload as GitHubPRPayload)
    }
    // All other events are ignored (ping, push, milestone, etc.)
  } catch (err) {
    console.error('[github/webhook] processing error', err)
    // Return 200 to avoid GitHub marking the webhook as failing — we log internally.
    return NextResponse.json({ ok: false, error: String(err) })
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Helper: resolve team_member by github_handle
// ---------------------------------------------------------------------------

async function memberByHandle(
  supabase: ReturnType<typeof createAdminClient>,
  handle: string | null | undefined,
): Promise<string | null> {
  if (!handle) return null
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('github_handle', handle)
    .is('deleted_at', null)
    .maybeSingle()
  return (data?.id as string | null) ?? null
}

// ---------------------------------------------------------------------------
// Helper: resolve task by github_issue_number (within any project)
// ---------------------------------------------------------------------------

async function taskByIssue(
  supabase: ReturnType<typeof createAdminClient>,
  issueNumber: number,
): Promise<{ id: string; project_id: string | null } | null> {
  const { data } = await supabase
    .from('tasks')
    .select('id, project_id')
    .eq('github_issue_number', issueNumber)
    .is('deleted_at', null)
    .maybeSingle()
  return data as { id: string; project_id: string | null } | null
}

// ---------------------------------------------------------------------------
// Helper: resolve project by repo owner + name
// ---------------------------------------------------------------------------

async function projectByRepo(
  supabase: ReturnType<typeof createAdminClient>,
  owner: string,
  name: string,
): Promise<string | null> {
  // Only projects in bidirectional sync mode accept inbound webhook events.
  // Link-only / none projects ignore GitHub activity entirely.
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('github_repo_owner', owner)
    .eq('github_repo_name', name)
    .eq('github_sync_mode', 'bidirectional')
    .maybeSingle()
  return (data?.id as string | null) ?? null
}

// ---------------------------------------------------------------------------
// issues + issue_comment
// ---------------------------------------------------------------------------

async function handleIssueEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: string,
  payload: GitHubIssuePayload,
) {
  const { action, issue, sender } = payload
  const issueNumber = issue.number

  // --- issue_comment.created ---
  if (event === 'issue_comment' && action === 'created' && payload.comment) {
    const task = await taskByIssue(supabase, issueNumber)
    if (!task) return
    const authorId = await memberByHandle(supabase, payload.comment.user.login)
    if (!authorId) return // ignore ghost handles
    await supabase.from('task_comments').insert({
      task_id: task.id,
      author_id: authorId,
      body: payload.comment.body,
      source: 'github',
      github_comment_id: payload.comment.id,
    })
    return
  }

  if (event !== 'issues') return

  // --- issues.opened ---
  if (action === 'opened') {
    // If we already have this task it means we created the issue from the CRM — skip.
    const existing = await taskByIssue(supabase, issueNumber)
    if (existing) return

    const repo = payload.repository
    if (!repo) return
    const projectId = await projectByRepo(supabase, repo.owner.login, repo.name)
    if (!projectId) return // repo not linked to any project

    const assigneeId = await memberByHandle(supabase, issue.assignee?.login)
    await supabase.from('tasks').insert({
      project_id: projectId,
      title: issue.title,
      description: issue.body ?? null,
      status: 'todo',
      github_issue_number: issueNumber,
      github_issue_url: issue.html_url,
      github_synced_at: new Date().toISOString(),
      assignee_id: assigneeId,
    })
    return
  }

  // --- issues.closed ---
  if (action === 'closed') {
    const task = await taskByIssue(supabase, issueNumber)
    if (!task) return
    await supabase
      .from('tasks')
      .update({
        status: 'done',
        completed_at: new Date().toISOString(),
        github_synced_at: new Date().toISOString(),
      })
      .eq('id', task.id)
    return
  }

  // --- issues.reopened ---
  if (action === 'reopened') {
    const task = await taskByIssue(supabase, issueNumber)
    if (!task) return
    await supabase
      .from('tasks')
      .update({ status: 'todo', completed_at: null, github_synced_at: new Date().toISOString() })
      .eq('id', task.id)
    return
  }

  // --- issues.assigned ---
  if (action === 'assigned') {
    const task = await taskByIssue(supabase, issueNumber)
    if (!task) return
    const assigneeId = await memberByHandle(supabase, payload.assignee?.login ?? sender.login)
    if (!assigneeId) return
    await supabase
      .from('tasks')
      .update({ assignee_id: assigneeId, github_synced_at: new Date().toISOString() })
      .eq('id', task.id)
    return
  }

  // --- issues.labeled ---
  if (action === 'labeled') {
    const task = await taskByIssue(supabase, issueNumber)
    if (!task?.project_id) return
    // Ensure all labels exist as task_tags in the project, then assign them.
    for (const label of issue.labels) {
      const { data: tag } = await supabase
        .from('task_tags')
        .upsert(
          { project_id: task.project_id, name: label.name, color: '#6366f1' },
          { onConflict: 'project_id,name' },
        )
        .select('id')
        .single()
      if (!tag) continue
      await supabase
        .from('task_tag_assignments')
        .upsert({ task_id: task.id, tag_id: tag.id as string }, { onConflict: 'task_id,tag_id' })
    }
    return
  }
}

// ---------------------------------------------------------------------------
// pull_request
// ---------------------------------------------------------------------------

async function handlePREvent(
  supabase: ReturnType<typeof createAdminClient>,
  payload: GitHubPRPayload,
) {
  const { action, pull_request: pr } = payload
  const synced = new Date().toISOString()

  // Try to extract the linked issue number from the PR body via "Closes #N" / "Fixes #N"
  const closesMatch = pr.body?.match(/(?:closes|fixes|resolves)\s+#(\d+)/i)
  const linkedIssueNumber = closesMatch ? Number(closesMatch[1]) : null
  const task = linkedIssueNumber ? await taskByIssue(supabase, linkedIssueNumber) : null

  if (action === 'opened') {
    if (!task) return
    await supabase
      .from('tasks')
      .update({ github_pr_number: pr.number, github_pr_url: pr.html_url, github_synced_at: synced })
      .eq('id', task.id)
    return
  }

  if (action === 'closed') {
    if (!task) return
    const newStatus = pr.merged ? 'done' : 'todo'
    await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: pr.merged ? synced : null,
        github_synced_at: synced,
      })
      .eq('id', task.id)
    return
  }
}
