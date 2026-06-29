import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

const CANDIDATES = [
  '/opt/homebrew/bin/gh',
  '/usr/local/bin/gh',
  '/usr/bin/gh',
  'C:\\Program Files\\GitHub CLI\\gh.exe',
]

let cachedPath: string | null | undefined

export function pickGhPath(candidates: string[], exists: (p: string) => boolean): string | null {
  for (const c of candidates) if (exists(c)) return c
  return null
}

export function isAuthedFromStatus(exitCode: number, _output: string): boolean {
  return exitCode === 0
}

/** Resolve gh once (PATH first, then known locations). */
export async function resolveGh(): Promise<string | null> {
  if (cachedPath !== undefined) return cachedPath
  try {
    const which = process.platform === 'win32' ? 'where' : 'which'
    const { stdout } = await exec(which, ['gh'])
    const fromPath = stdout.split('\n')[0].trim()
    if (fromPath && existsSync(fromPath)) { cachedPath = fromPath; return cachedPath }
  } catch { /* fall through to candidates */ }
  cachedPath = pickGhPath(CANDIDATES, existsSync)
  return cachedPath
}

export async function ghAvailable(): Promise<boolean> {
  return (await resolveGh()) !== null
}

export async function ghAuthed(): Promise<boolean> {
  const gh = await resolveGh()
  if (!gh) return false
  try {
    await exec(gh, ['auth', 'status'])
    return true
  } catch (e) {
    const code = (e as { code?: number }).code ?? 1
    return isAuthedFromStatus(typeof code === 'number' ? code : 1, '')
  }
}

/** Run gh with the resolved path; throws a structured error when unavailable. */
export async function runGh(args: string[], cwd: string, maxBuffer = 10 * 1024 * 1024) {
  const gh = await resolveGh()
  if (!gh) {
    const err = new Error('gh-unavailable') as Error & { code: string }
    err.code = 'GH_UNAVAILABLE'
    throw err
  }
  return exec(gh, args, { cwd, maxBuffer })
}
