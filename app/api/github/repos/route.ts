import { requireUser } from '@/lib/auth'
import { githubDefaultInstallationId } from '@/lib/env'
import { listInstallationRepos } from '@/lib/integrations/github'

/**
 * GET /api/github/repos
 * Returns the list of repositories accessible to the default GitHub App installation.
 * Used by the project form to let the user pick a repo from the org.
 */
export async function GET() {
  await requireUser()

  const installationId = githubDefaultInstallationId()
  if (!installationId) {
    return Response.json({ repos: [] })
  }

  try {
    const repos = await listInstallationRepos(installationId)
    return Response.json({ repos })
  } catch (err) {
    console.error('[github/repos] Failed to list installation repos:', err)
    return Response.json({ repos: [] }, { status: 500 })
  }
}
