import type { SimpleGit } from 'simple-git'
import { buildAuthHeader } from './authHeader'
import { toHttpsRemoteUrl } from './githubUrl'

/**
 * Git `-c` args that authenticate HTTPS GitHub operations with the OAuth token.
 * Prepend these to any remote git command (fetch/pull/push) so auth is applied
 * uniformly and never depends on an ambient credential helper or ssh key.
 */
export function authConfigArgs(token: string): string[] {
  return ['-c', `http.https://github.com/.extraheader=${buildAuthHeader(token)}`]
}

/**
 * Normalize a repo's origin to the canonical HTTPS url so token auth applies.
 * Rewrites (via `setUrl`) only when origin is a GitHub remote that isn't already
 * canonical https; leaves non-GitHub or already-canonical remotes untouched.
 * Returns the url the caller should treat as origin going forward.
 */
export async function ensureHttpsRemote(
  currentUrl: string,
  setUrl: (url: string) => Promise<void>,
): Promise<string> {
  const https = toHttpsRemoteUrl(currentUrl)
  if (!https || https === currentUrl) return currentUrl
  await setUrl(https)
  return https
}

/**
 * Prepare a repo for an authenticated remote operation: normalize origin to
 * https (so token auth applies even to ssh-cloned repos) and return the git
 * `-c` auth args to prepend to the command. Returns `[]` when no token is
 * available, leaving origin untouched — callers then behave as before.
 */
export async function prepareRemoteAuth(git: SimpleGit, token?: string): Promise<string[]> {
  if (!token) return []
  const current = (await git.remote(['get-url', 'origin']))?.trim() || ''
  await ensureHttpsRemote(current, async (url) => { await git.remote(['set-url', 'origin', url]) })
  return authConfigArgs(token)
}
