export interface OwnerRepo { owner: string; repo: string }

/** Parse owner/repo from a GitHub https or ssh remote URL. */
export function parseOwnerRepo(remoteUrl: string): OwnerRepo | null {
  const cleaned = remoteUrl.trim().replace(/\.git$/, '')
  const https = cleaned.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/)
  if (https) return { owner: https[1], repo: https[2] }
  const ssh = cleaned.match(/^git@github\.com:([^/]+)\/([^/]+)$/)
  if (ssh) return { owner: ssh[1], repo: ssh[2] }
  return null
}

/**
 * Canonical HTTPS remote URL for a GitHub repo, from any https or ssh remote.
 * Atlas authenticates git over HTTPS (http.extraheader), so ssh remotes must be
 * normalized to https for that auth to apply. Returns null for non-GitHub remotes.
 */
export function toHttpsRemoteUrl(remoteUrl: string): string | null {
  const parsed = parseOwnerRepo(remoteUrl)
  if (!parsed) return null
  return `https://github.com/${parsed.owner}/${parsed.repo}.git`
}
