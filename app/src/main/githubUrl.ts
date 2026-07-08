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
