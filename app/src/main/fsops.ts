import { mkdir, rename, rm, writeFile, access, readdir } from 'fs/promises'
import { dirname } from 'path'

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

export async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true })
}

/** Create a file, making parent dirs; throws if the file already exists (never clobbers). */
export async function createFile(p: string, content: string): Promise<void> {
  if (await pathExists(p)) throw new Error('A file with that name already exists')
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, content, 'utf-8')
}

/** Move/rename; throws if the destination already exists. */
export async function move(from: string, to: string): Promise<void> {
  if (await pathExists(to)) throw new Error('Something with that name already exists there')
  await mkdir(dirname(to), { recursive: true })
  await rename(from, to)
}

/** Recursively delete a file or folder. */
export async function del(p: string): Promise<void> {
  await rm(p, { recursive: true, force: true })
}

/** All folders under root (system-relative), excluding .git and node_modules. */
export async function listFolders(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries
    try { entries = await readdir(absDir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === '.git' || e.name === 'node_modules') continue
      const rel = relDir ? `${relDir}/${e.name}` : e.name
      out.push(rel)
      await walk(`${absDir}/${e.name}`, rel)
    }
  }
  await walk(root, '')
  return out
}

/** All files under root (system-relative), excluding hidden dirs and node_modules. Powers file search. */
export async function listFiles(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries
    try { entries = await readdir(absDir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue
        await walk(`${absDir}/${e.name}`, rel)
      } else if (e.isFile() && !e.name.startsWith('.')) {
        out.push(rel)
      }
    }
  }
  await walk(root, '')
  return out
}
