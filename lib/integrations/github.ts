/**
 * GitHub App integration client.
 *
 * Uses GitHub REST API v3 with JWT-based GitHub App authentication.
 * Does NOT require any extra npm package — uses the built-in fetch + crypto APIs.
 *
 * Required env vars (see lib/env.ts):
 *   GITHUB_APP_ID
 *   GITHUB_APP_PRIVATE_KEY_BASE64   (PEM key, base64-encoded)
 *   GITHUB_WEBHOOK_SECRET
 */

import { createHmac, createSign } from 'node:crypto'

import { serverEnv } from '@/lib/env'

// ---------------------------------------------------------------------------
// JWT / App auth
// ---------------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Creates a short-lived JWT signed with the GitHub App's RSA private key.
 * Valid for 60 seconds (GitHub allows up to 10 min, but we keep it tight).
 */
function createAppJwt(appId: string, privateKeyBase64: string): string {
  const privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf8')
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = base64url(
    Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 60, iss: appId })),
  )
  const data = `${header}.${payload}`
  const sign = createSign('RSA-SHA256')
  sign.update(data)
  const signature = base64url(sign.sign(privateKeyPem))
  return `${data}.${signature}`
}

/**
 * Obtains an installation access token for the given installation ID.
 * Tokens are valid 1h; the caller is responsible for caching if needed.
 */
async function getInstallationToken(installationId: number): Promise<string> {
  const env = serverEnv()
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY_BASE64) {
    throw new Error('GitHub App not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY_BASE64)')
  }
  const jwt = createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY_BASE64)
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub: could not get installation token — ${res.status} ${text}`)
  }
  const data = (await res.json()) as { token: string }
  return data.token
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Validates the X-Hub-Signature-256 header sent by GitHub on every webhook.
 */
export function verifyGitHubSignature(rawBody: string, signatureHeader: string | null): boolean {
  const env = serverEnv()
  if (!env.GITHUB_WEBHOOK_SECRET || !signatureHeader) return false
  const expected = `sha256=${createHmac('sha256', env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest('hex')}`
  // Constant-time compare
  if (expected.length !== signatureHeader.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return diff === 0
}

// ---------------------------------------------------------------------------
// REST API helpers
// ---------------------------------------------------------------------------

async function ghFetch<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  html_url: string
  private: boolean
}

/**
 * Lists all repositories accessible to a given installation (up to 100).
 * Uses the installation access token, so only repos the App can see are returned.
 */
export async function listInstallationRepos(installationId: number): Promise<GitHubRepo[]> {
  const token = await getInstallationToken(installationId)
  const data = await ghFetch<{ repositories: GitHubRepo[] }>(
    token,
    'GET',
    '/installation/repositories?per_page=100',
  )
  return data.repositories ?? []
}

export interface GitHubIssueResult {
  number: number
  html_url: string
  state: 'open' | 'closed'
}

export interface GitHubPRResult {
  number: number
  html_url: string
  state: 'open' | 'closed'
  merged: boolean
}

export interface CreateIssueParams {
  installationId: number
  owner: string
  repo: string
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
}

export async function createGitHubIssue(params: CreateIssueParams): Promise<GitHubIssueResult> {
  const token = await getInstallationToken(params.installationId)
  return ghFetch<GitHubIssueResult>(token, 'POST', `/repos/${params.owner}/${params.repo}/issues`, {
    title: params.title,
    body: params.body ?? '',
    labels: params.labels ?? [],
    assignees: params.assignees ?? [],
  })
}

// ---------------------------------------------------------------------------
// Branch helpers
// ---------------------------------------------------------------------------

/**
 * Slugifies a task title into a valid git branch segment (≤ 50 chars).
 */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

/**
 * Builds the branch name for an issue: `feature/{issueNumber}-{slug}`.
 */
export function issueBranchName(issueNumber: number, title: string): string {
  return `feature/${issueNumber}-${slugifyTitle(title)}`
}

/**
 * Creates a branch off the repository's default branch HEAD.
 * Reuses a single installation token for all three API calls.
 * Returns the full branch name (e.g. "feature/42-fix-login").
 */
export async function createGitHubBranchFromDefault(params: {
  installationId: number
  owner: string
  repo: string
  branchName: string
}): Promise<string> {
  const token = await getInstallationToken(params.installationId)
  const { default_branch } = await ghFetch<{ default_branch: string }>(
    token,
    'GET',
    `/repos/${params.owner}/${params.repo}`,
  )
  const refData = await ghFetch<{ object: { sha: string } }>(
    token,
    'GET',
    `/repos/${params.owner}/${params.repo}/git/ref/heads/${default_branch}`,
  )
  await ghFetch(token, 'POST', `/repos/${params.owner}/${params.repo}/git/refs`, {
    ref: `refs/heads/${params.branchName}`,
    sha: refData.object.sha,
  })
  return params.branchName
}

/**
 * Opens or closes a GitHub issue.
 * Closing: done / cancelled statuses.
 * Opening: any other status (todo, in_progress, in_review).
 */
export async function updateGitHubIssueState(
  installationId: number,
  owner: string,
  repo: string,
  issueNumber: number,
  state: 'open' | 'closed',
): Promise<void> {
  const token = await getInstallationToken(installationId)
  await ghFetch(token, 'PATCH', `/repos/${owner}/${repo}/issues/${issueNumber}`, { state })
}

export async function getGitHubIssue(
  installationId: number,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GitHubIssueResult> {
  const token = await getInstallationToken(installationId)
  return ghFetch<GitHubIssueResult>(token, 'GET', `/repos/${owner}/${repo}/issues/${issueNumber}`)
}
