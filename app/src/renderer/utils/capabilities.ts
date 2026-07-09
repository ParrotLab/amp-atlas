export interface Caps { isGitRepo: boolean; connected: boolean }

/** GitHub actions (publish, review, fetch collaborators) require a git repo, a token, AND a live connection. */
export function githubActionsAvailable(caps: Caps, online: boolean): boolean {
  return caps.isGitRepo && caps.connected && online
}
