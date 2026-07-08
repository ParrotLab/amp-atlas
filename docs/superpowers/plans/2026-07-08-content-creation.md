# Content Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian-grade file/folder operations (create, rename, move via drag-and-drop + picker, delete) plus opinionated one-click scaffolds (New Playbook / Project / Sub-system) from editable templates, with always-visible canonical sections and lazy folder creation — all gated to a Draft.

**Architecture:** Editable templates live in `app/templates/` and bundle via Vite `?raw`. A pure `scaffold` module maps type+name → files. New main-process `fsops` (mkdir/createFile/move/delete) are called by IPC handlers. The renderer's `FileTree` renders the canonical structure, a "+ New" menu, a right-click context menu, and drag-and-drop; `SystemOverview` owns the create/move/delete orchestration + a `NewItemModal` with a live slug preview, gated to Drafts.

**Tech Stack:** Electron + Node `fs/promises`, React 19, Vite `?raw`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-content-creation-design.md`

---

## File Structure

**New**
- `app/templates/playbook/SKILL.md`, `app/templates/project/pitch.md`, `app/templates/project/braindump.md`, `app/templates/sub-system/README.md` — editable seed templates.
- `app/src/renderer/utils/templates.ts` — Vite `?raw` manifest.
- `app/src/renderer/utils/scaffold.ts` (+ tests) — `slugify`, `scaffoldFor`, `CANONICAL_FOLDERS`, `isProtectedPath`.
- `app/src/main/fsops.ts` (+ tests) — `ensureDir`, `createFile`, `move`, `del`.
- `app/src/renderer/components/NewItemModal.tsx` (+ `.css`) — name + live slug/path preview.
- `app/src/renderer/components/TreeContextMenu.tsx` (+ `.css`) — right-click menu.

**Modify**
- `app/src/main/index.ts` — `fs:mkdir`/`fs:createFile`/`fs:move`/`fs:delete` IPC.
- `app/src/preload/index.ts` + `app/src/renderer/env.d.ts` — new fs methods + `*?raw` module decl.
- `app/src/renderer/components/FileTree.tsx` (+ `.css`) — canonical sections always visible, empty states, "+ New" header, context menu, drag-and-drop, Copy path.
- `app/src/renderer/pages/SystemOverview.tsx` — create/move/rename/delete orchestration, `NewItemModal`, draft-gating.

**Conventions:** commands from `app/`; `git` from repo root (`cd ..`). Every task ends in a commit.

---

## Phase 0 — Templates + pure logic + fs ops

### Task 1: Seed templates + manifest

**Files:**
- Create: `app/templates/playbook/SKILL.md`, `app/templates/project/pitch.md`, `app/templates/project/braindump.md`, `app/templates/sub-system/README.md`
- Create: `app/src/renderer/utils/templates.ts`
- Modify: `app/src/renderer/env.d.ts` (raw-module decl)

- [ ] **Step 1: Create the seed template files**

`app/templates/playbook/SKILL.md`:

```markdown
---
name: {{name}}
description:
type: playbook
sub-system:
status: Draft
---

# {{name}}

## Process

1.
```

`app/templates/project/pitch.md`:

```markdown
# {{name}} — Pitch

_Created {{date}}_

## Problem

## Proposed approach

## Success looks like
```

`app/templates/project/braindump.md`:

```markdown
# {{name}} — Braindump

_Created {{date}}_

-
```

`app/templates/sub-system/README.md`:

```markdown
# {{name}}

_A knowledge sub-system. Created {{date}}._
```

- [ ] **Step 2: Add the raw-import declaration**

In `app/src/renderer/env.d.ts`, add at the top (near the other `declare module` blocks):

```typescript
declare module '*?raw' {
  const src: string
  export default src
}
```

- [ ] **Step 3: Create the manifest**

Create `app/src/renderer/utils/templates.ts`:

```typescript
import playbookSkill from '../../../templates/playbook/SKILL.md?raw'
import projectPitch from '../../../templates/project/pitch.md?raw'
import projectBraindump from '../../../templates/project/braindump.md?raw'
import subsystemReadme from '../../../templates/sub-system/README.md?raw'

export const TEMPLATES = {
  playbookSkill,
  projectPitch,
  projectBraindump,
  subsystemReadme,
}
```

- [ ] **Step 4: Sanity build**

Run: `cd app && npm run build`
Expected: build succeeds (confirms `?raw` imports resolve).

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/templates app/src/renderer/utils/templates.ts app/src/renderer/env.d.ts && git commit -m "feat: editable scaffold templates + raw manifest"
```

### Task 2: `scaffold` (pure)

**Files:**
- Create: `app/src/renderer/utils/scaffold.ts`
- Test: `app/src/renderer/utils/__tests__/scaffold.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/renderer/utils/__tests__/scaffold.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { slugify, scaffoldFor, isProtectedPath, CANONICAL_FOLDERS } from '../scaffold'

describe('slugify', () => {
  it('lowercases, dashes spaces, strips punctuation and edges', () => {
    expect(slugify('My Q3 Plan!')).toBe('my-q3-plan')
    expect(slugify('  Hello  World  ')).toBe('hello-world')
  })
})

describe('scaffoldFor', () => {
  it('playbook → .claude/skills/<slug>/SKILL.md with the name substituted', () => {
    const { folder, files } = scaffoldFor('playbook', 'Onboarding', '2026-07-08')
    expect(folder).toBe('.claude/skills/onboarding')
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('.claude/skills/onboarding/SKILL.md')
    expect(files[0].content).toContain('name: Onboarding')
    expect(files[0].content).not.toContain('{{name}}')
  })

  it('project → work/<slug>/pitch.md + braindump.md', () => {
    const { files } = scaffoldFor('project', 'Launch Plan', '2026-07-08')
    expect(files.map(f => f.path).sort()).toEqual(['work/launch-plan/braindump.md', 'work/launch-plan/pitch.md'])
    expect(files[0].content).toContain('2026-07-08')
  })

  it('sub-system → reference/<slug>/README.md', () => {
    const { files } = scaffoldFor('sub-system', 'Sales', '2026-07-08')
    expect(files[0].path).toBe('reference/sales/README.md')
  })
})

describe('isProtectedPath', () => {
  it('protects the canonical top-level folders exactly', () => {
    for (const f of CANONICAL_FOLDERS) expect(isProtectedPath(f)).toBe(true)
    expect(isProtectedPath('work/thing')).toBe(false)
    expect(isProtectedPath('notes.md')).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/scaffold.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/renderer/utils/scaffold.ts`:

```typescript
import { TEMPLATES } from './templates'

export type ScaffoldType = 'playbook' | 'project' | 'sub-system'
export const CANONICAL_FOLDERS = ['readmes', 'reference', 'work', '.claude']

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function render(tpl: string, name: string, date: string): string {
  return tpl.split('{{name}}').join(name).split('{{date}}').join(date)
}

export interface ScaffoldFile { path: string; content: string }

/** Map a scaffold type + name to system-relative files with rendered content. */
export function scaffoldFor(type: ScaffoldType, name: string, date: string): { folder: string; files: ScaffoldFile[] } {
  const slug = slugify(name)
  if (type === 'playbook') {
    const folder = `.claude/skills/${slug}`
    return { folder, files: [{ path: `${folder}/SKILL.md`, content: render(TEMPLATES.playbookSkill, name, date) }] }
  }
  if (type === 'project') {
    const folder = `work/${slug}`
    return {
      folder,
      files: [
        { path: `${folder}/pitch.md`, content: render(TEMPLATES.projectPitch, name, date) },
        { path: `${folder}/braindump.md`, content: render(TEMPLATES.projectBraindump, name, date) },
      ],
    }
  }
  const folder = `reference/${slug}`
  return { folder, files: [{ path: `${folder}/README.md`, content: render(TEMPLATES.subsystemReadme, name, date) }] }
}

/** True if a system-relative path IS one of the protected top-level folders. */
export function isProtectedPath(relPath: string): boolean {
  return CANONICAL_FOLDERS.includes(relPath.replace(/^\/+|\/+$/g, ''))
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/scaffold.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/renderer/utils/scaffold.ts app/src/renderer/utils/__tests__/scaffold.test.ts && git commit -m "feat: pure scaffold engine (slugify, scaffoldFor, protected paths)"
```

### Task 3: `fsops` + IPC

**Files:**
- Create: `app/src/main/fsops.ts`
- Test: `app/src/main/__tests__/fsops.test.ts`
- Modify: `app/src/main/index.ts`, `app/src/preload/index.ts`, `app/src/renderer/env.d.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/main/__tests__/fsops.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ensureDir, createFile, move, del, listFolders } from '../fsops'

function tmp(): string { return mkdtempSync(join(tmpdir(), 'amp-fs-')) }

describe('fsops', () => {
  it('ensureDir creates nested dirs', async () => {
    const d = tmp()
    await ensureDir(join(d, 'a/b/c'))
    expect(existsSync(join(d, 'a/b/c'))).toBe(true)
  })

  it('createFile writes content and creates parents; errors if it exists', async () => {
    const d = tmp()
    const f = join(d, 'work/x/pitch.md')
    await createFile(f, 'hi')
    expect(readFileSync(f, 'utf-8')).toBe('hi')
    await expect(createFile(f, 'again')).rejects.toThrow()
  })

  it('move renames/moves and errors if the target exists', async () => {
    const d = tmp()
    writeFileSync(join(d, 'a.md'), '1')
    await move(join(d, 'a.md'), join(d, 'sub/b.md'))
    expect(existsSync(join(d, 'sub/b.md'))).toBe(true)
    expect(existsSync(join(d, 'a.md'))).toBe(false)
    writeFileSync(join(d, 'c.md'), '2')
    await expect(move(join(d, 'c.md'), join(d, 'sub/b.md'))).rejects.toThrow()
  })

  it('del removes files and folders recursively', async () => {
    const d = tmp()
    await createFile(join(d, 'work/x/pitch.md'), 'hi')
    await del(join(d, 'work/x'))
    expect(existsSync(join(d, 'work/x'))).toBe(false)
  })

  it('listFolders returns nested folders (relative), excluding .git', async () => {
    const d = tmp()
    await ensureDir(join(d, 'work/x'))
    await ensureDir(join(d, 'reference'))
    await ensureDir(join(d, '.git/objects'))
    const folders = await listFolders(d)
    expect(folders).toContain('work')
    expect(folders).toContain('work/x')
    expect(folders).toContain('reference')
    expect(folders.some(f => f.startsWith('.git'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/fsops.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/main/fsops.ts`:

```typescript
import { mkdir, rename, rm, writeFile, access, readdir } from 'fs/promises'
import { dirname } from 'path'

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
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
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/fsops.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add IPC handlers**

In `app/src/main/index.ts`, add the import:

```typescript
import { ensureDir, createFile, move as movePath, del as delPath, listFolders } from './fsops'
```

Add handlers near the other `fs:` handlers:

```typescript
ipcMain.handle('fs:mkdir', async (_event, path: string) => {
  try { await ensureDir(path); return { ok: true } } catch (error) { return { ok: false, error: String(error) } }
})
ipcMain.handle('fs:createFile', async (_event, path: string, content: string) => {
  try { await createFile(path, content); return { ok: true } } catch (error) { return { ok: false, error: String((error as Error).message || error) } }
})
ipcMain.handle('fs:move', async (_event, from: string, to: string) => {
  try { await movePath(from, to); return { ok: true } } catch (error) { return { ok: false, error: String((error as Error).message || error) } }
})
ipcMain.handle('fs:delete', async (_event, path: string) => {
  try { await delPath(path); return { ok: true } } catch (error) { return { ok: false, error: String((error as Error).message || error) } }
})
ipcMain.handle('fs:listFolders', async (_event, root: string) => {
  try { return { ok: true, folders: await listFolders(root) } } catch (error) { return { ok: false, error: String(error), folders: [] } }
})
```

- [ ] **Step 6: Preload + types**

In `app/src/preload/index.ts`, add to the `fs` object:

```typescript
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    createFile: (path: string, content: string) => ipcRenderer.invoke('fs:createFile', path, content),
    move: (from: string, to: string) => ipcRenderer.invoke('fs:move', from, to),
    delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
    listFolders: (root: string) => ipcRenderer.invoke('fs:listFolders', root),
```

In `app/src/renderer/env.d.ts`, add to the `fs: {` block:

```typescript
    mkdir: (path: string) => Promise<{ ok: boolean; error?: string }>
    createFile: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>
    move: (from: string, to: string) => Promise<{ ok: boolean; error?: string }>
    delete: (path: string) => Promise<{ ok: boolean; error?: string }>
    listFolders: (root: string) => Promise<{ ok: boolean; error?: string; folders: string[] }>
```

- [ ] **Step 7: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd .. && git add app/src/main/fsops.ts app/src/main/__tests__/fsops.test.ts app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts && git commit -m "feat: fs mkdir/createFile/move/delete ops + IPC"
```

---

## Phase 1 — UI

### Task 4: `NewItemModal`

**Files:**
- Create: `app/src/renderer/components/NewItemModal.tsx`, `app/src/renderer/components/NewItemModal.css`

- [ ] **Step 1: Implement the modal**

Create `app/src/renderer/components/NewItemModal.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react'
import { slugify } from '../utils/scaffold'
import './NewItemModal.css'

interface NewItemModalProps {
  isOpen: boolean
  title: string                 // e.g. "New Project"
  previewFor: (slug: string) => string  // e.g. slug => `work/${slug}/`
  initialName?: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export default function NewItemModal({ isOpen, title, previewFor, initialName, onConfirm, onCancel }: NewItemModalProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, initialName])

  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isOpen, onCancel])

  if (!isOpen) return null
  const slug = slugify(name)
  const valid = slug.length > 0

  return (
    <div className="new-item-overlay" onClick={onCancel}>
      <div className="new-item-modal" onClick={e => e.stopPropagation()}>
        <div className="new-item-title">{title}</div>
        <input
          ref={inputRef}
          className="new-item-input"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && valid) onConfirm(name.trim()) }}
        />
        <div className="new-item-preview">{valid ? previewFor(slug) : 'Enter a name'}</div>
        <div className="new-item-actions">
          <button className="new-item-btn ghost" onClick={onCancel}>Cancel</button>
          <button className="new-item-btn primary" disabled={!valid} onClick={() => onConfirm(name.trim())}>Create</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Styles**

Create `app/src/renderer/components/NewItemModal.css`:

```css
.new-item-overlay { position: fixed; inset: 0; background: rgba(26,26,46,0.35); display: flex; align-items: center; justify-content: center; z-index: 1200; }
.new-item-modal { background: #fff; border-radius: 16px; padding: 24px; width: 420px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.new-item-title { font-size: 16px; font-weight: 600; color: #1a1a2e; margin-bottom: 14px; }
.new-item-input { width: 100%; padding: 10px 12px; font-size: 14px; border: 1px solid #EDE8E2; border-radius: 8px; font-family: inherit; box-sizing: border-box; }
.new-item-input:focus { outline: none; border-color: #8B2BFF; }
.new-item-preview { margin-top: 8px; font-size: 12px; color: #8E8B87; font-family: ui-monospace, monospace; }
.new-item-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.new-item-btn { padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: 8px; border: none; cursor: pointer; font-family: inherit; }
.new-item-btn.ghost { background: #F0EBE5; color: #6B6966; }
.new-item-btn.primary { background: #8B2BFF; color: #fff; }
.new-item-btn.primary:disabled { opacity: 0.45; cursor: default; }
```

- [ ] **Step 3: Build + commit**

Run: `cd app && npm run build`

```bash
cd .. && git add app/src/renderer/components/NewItemModal.tsx app/src/renderer/components/NewItemModal.css && git commit -m "feat: NewItemModal with live slug/path preview"
```

### Task 5: `TreeContextMenu`

**Files:**
- Create: `app/src/renderer/components/TreeContextMenu.tsx`, `app/src/renderer/components/TreeContextMenu.css`

- [ ] **Step 1: Implement**

Create `app/src/renderer/components/TreeContextMenu.tsx`:

```typescript
import { useEffect } from 'react'
import './TreeContextMenu.css'

export interface ContextTarget { path: string; isDirectory: boolean; relPath: string }

interface TreeContextMenuProps {
  x: number
  y: number
  target: ContextTarget
  onNewFile: (t: ContextTarget) => void
  onNewFolder: (t: ContextTarget) => void
  onRename: (t: ContextTarget) => void
  onMove: (t: ContextTarget) => void
  onCopyPath: (t: ContextTarget) => void
  onDelete: (t: ContextTarget) => void
  onClose: () => void
}

export default function TreeContextMenu(p: TreeContextMenuProps) {
  useEffect(() => {
    const h = () => p.onClose()
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [p])

  const item = (label: string, fn: () => void, danger = false) => (
    <button className={`tcm-item ${danger ? 'danger' : ''}`} onClick={(e) => { e.stopPropagation(); fn(); p.onClose() }}>{label}</button>
  )

  return (
    <div className="tcm" style={{ left: p.x, top: p.y }} onClick={e => e.stopPropagation()}>
      {p.target.isDirectory && item('New file here', () => p.onNewFile(p.target))}
      {p.target.isDirectory && item('New folder here', () => p.onNewFolder(p.target))}
      {item('Rename', () => p.onRename(p.target))}
      {item('Move to…', () => p.onMove(p.target))}
      {item('Copy path', () => p.onCopyPath(p.target))}
      {item('Delete', () => p.onDelete(p.target), true)}
    </div>
  )
}
```

- [ ] **Step 2: Styles**

Create `app/src/renderer/components/TreeContextMenu.css`:

```css
.tcm { position: fixed; z-index: 1300; background: #fff; border: 1px solid #EDE8E2; border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.14); padding: 6px; min-width: 160px; }
.tcm-item { display: block; width: 100%; text-align: left; padding: 7px 10px; font-size: 13px; color: #4A4743; background: none; border: none; border-radius: 6px; cursor: pointer; font-family: inherit; }
.tcm-item:hover { background: #F0EBE5; }
.tcm-item.danger { color: #DC2626; }
.tcm-item.danger:hover { background: #FEF2F2; }
```

- [ ] **Step 3: Build + commit**

Run: `cd app && npm run build`

```bash
cd .. && git add app/src/renderer/components/TreeContextMenu.tsx app/src/renderer/components/TreeContextMenu.css && git commit -m "feat: tree right-click context menu component"
```

### Task 6: FileTree — canonical sections, "+ New", context menu, drag-and-drop, Copy path

**Files:**
- Modify: `app/src/renderer/components/FileTree.tsx`, `app/src/renderer/components/FileTree.css`

Context: `FileTree` currently categorizes into `instructions` / `playbooks` / `files`. This task replaces that with the fixed canonical sections and adds interaction. It receives new props from `SystemOverview` (Task 7): `canEdit`, `onNeedDraft`, `onNewScaffold`, `onNewFile`, `onNewFolder`, `onRename`, `onMove`, `onDelete`. All callbacks take **absolute** paths.

- [ ] **Step 1: Extend props**

In `FileTreeProps`, add:

```typescript
  canEdit?: boolean
  onNeedDraft?: () => void
  onNewScaffold?: (type: 'playbook' | 'project' | 'sub-system') => void
  onNewFile?: (parentAbs: string) => void
  onNewFolder?: (parentAbs: string) => void
  onRename?: (absPath: string, isDir: boolean) => void
  onMove?: (fromAbs: string, toFolderAbs: string) => void
  onDelete?: (absPath: string, isDir: boolean) => void
```

Add them to the destructure, plus `refreshToken` already exists.

- [ ] **Step 2: Fixed canonical sections load**

Replace `loadCategories` with a version that loads each canonical folder's entries (empty if absent) and keeps the "Instructions" (root README/CLAUDE) and Playbooks (`.claude/skills`) sections:

```typescript
  const [sections, setSections] = useState<{ key: string; label: string; folderRel: string; nodes: TreeNode[]; isPlaybook?: boolean }[]>([])

  const loadCategories = useCallback(async () => {
    const readSection = async (folderRel: string): Promise<TreeNode[]> => {
      const res = await window.api.fs.readDirectory(`${rootPath}/${folderRel}`)
      return res.ok && res.entries ? res.entries.map(e => ({ ...e, depth: 0, expanded: false })) : []
    }
    const rootRes = await window.api.fs.readDirectory(rootPath)
    const instructions = (rootRes.ok && rootRes.entries ? rootRes.entries : [])
      .filter(e => !e.isDirectory && (e.name === 'README.md' || e.name === 'CLAUDE.md'))
      .map(e => ({ ...e, depth: 0, expanded: false }))
    const skills = await readSection('.claude/skills')
    const readmes = await readSection('readmes')
    const reference = await readSection('reference')
    const work = await readSection('work')
    setSections([
      { key: 'instructions', label: 'Instructions', folderRel: '', nodes: instructions },
      { key: 'playbooks', label: 'Playbooks', folderRel: '.claude/skills', nodes: skills, isPlaybook: true },
      { key: 'readmes', label: 'Readmes', folderRel: 'readmes', nodes: readmes },
      { key: 'reference', label: 'Reference', folderRel: 'reference', nodes: reference },
      { key: 'work', label: 'Work', folderRel: 'work', nodes: work },
    ])
  }, [rootPath])
```

Remove the old `categories` state, the `CategorizedTree` interface, and the old `setCategories(...)` usages (the refresh effect keeps calling `loadCategories()`; leave it).

- [ ] **Step 3: Context menu + drag-and-drop state + Copy path**

Add near the top of the component:

```typescript
  const [menu, setMenu] = useState<{ x: number; y: number; target: import('./TreeContextMenu').ContextTarget } | null>(null)

  const relOf = (abs: string) => abs.replace(rootPath + '/', '')
  const copyPath = (t: { relPath: string }) => navigator.clipboard.writeText(t.relPath)

  const openMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault(); e.stopPropagation()
    if (!canEdit) { onNeedDraft?.(); return }
    setMenu({ x: e.clientX, y: e.clientY, target: { path: node.path, isDirectory: node.isDirectory, relPath: relOf(node.path) } })
  }
```

Import at top: `import TreeContextMenu from './TreeContextMenu'`.

- [ ] **Step 4: Wire item rendering — right-click + drag-and-drop**

In `renderItem`, on the item `<div ...>` add:

```tsx
          onContextMenu={(e) => openMenu(e, node)}
          draggable={canEdit}
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', node.path) }}
          onDragOver={(e) => { if (node.isDirectory && canEdit) e.preventDefault() }}
          onDrop={(e) => {
            if (!node.isDirectory || !canEdit) return
            e.preventDefault(); e.stopPropagation()
            const from = e.dataTransfer.getData('text/plain')
            if (from && from !== node.path) onMove?.(from, node.path)
          }}
```

- [ ] **Step 5: "+ New" header + render sections + empty states + menu**

Replace the `return ( ... )` block's top so the header has the "+ New" menu and sections render from `sections` (each shows an empty state if `nodes` is empty). Add a `showNew` state (`const [showNew, setShowNew] = useState(false)`) and:

```tsx
  return (
    <>
      <div className="file-tree-header">
        <div className="file-tree-newwrap">
          <button className="file-tree-new" onClick={() => canEdit ? setShowNew(v => !v) : onNeedDraft?.()}>+ New</button>
          {showNew && (
            <>
              <div className="tcm-overlay" onClick={() => setShowNew(false)} />
              <div className="tcm" style={{ left: 12, top: 40 }}>
                <button className="tcm-item" onClick={() => { setShowNew(false); onNewScaffold?.('playbook') }}>New Playbook</button>
                <button className="tcm-item" onClick={() => { setShowNew(false); onNewScaffold?.('project') }}>New Project</button>
                <button className="tcm-item" onClick={() => { setShowNew(false); onNewScaffold?.('sub-system') }}>New Sub-system</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="file-tree-search">
        <input type="text" placeholder="Search files... (Cmd+K)" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="file-tree">
        {sections.map(sec => (
          <div key={sec.key}>
            <div className="tree-section-label">{sec.label}</div>
            {sec.nodes.length > 0
              ? sec.nodes.map(node => renderItem(node, 0, sec.isPlaybook))
              : <div className="tree-empty">Nothing here yet</div>}
          </div>
        ))}
      </div>
      {menu && (
        <TreeContextMenu
          x={menu.x} y={menu.y} target={menu.target}
          onNewFile={(t) => onNewFile?.(t.isDirectory ? t.path : t.path.replace(/\/[^/]+$/, ''))}
          onNewFolder={(t) => onNewFolder?.(t.isDirectory ? t.path : t.path.replace(/\/[^/]+$/, ''))}
          onRename={(t) => onRename?.(t.path, t.isDirectory)}
          onMove={(t) => onMove?.(t.path, '')}
          onCopyPath={(t) => copyPath(t)}
          onDelete={(t) => onDelete?.(t.path, t.isDirectory)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
```

(Note: `onMove` from the context menu passes `''` as the destination, signalling SystemOverview to open its "Move to…" picker; drag-and-drop passes a real destination folder.)

- [ ] **Step 6: Styles**

Append to `app/src/renderer/components/FileTree.css`:

```css
.file-tree-header { padding: 10px 12px 4px; }
.file-tree-newwrap { position: relative; }
.file-tree-new { width: 100%; padding: 8px; font-size: 13px; font-weight: 500; color: #fff; background: #8B2BFF; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; }
.file-tree-new:hover { background: #7A1FE6; }
.tcm-overlay { position: fixed; inset: 0; z-index: 1299; }
.tree-empty { padding: 6px 14px 10px; font-size: 12px; color: #C4BFB9; }
```

- [ ] **Step 7: Typecheck (SystemOverview errors expected until Task 7)**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit 2>&1 | grep FileTree || echo "FileTree clean"`
Expected: `FileTree clean`.

- [ ] **Step 8: Commit**

```bash
cd .. && git add app/src/renderer/components/FileTree.tsx app/src/renderer/components/FileTree.css && git commit -m "feat: FileTree canonical sections, + New menu, context menu, drag-and-drop"
```

---

## Phase 2 — Orchestration

### Task 7: SystemOverview — create/move/rename/delete + gating

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`

- [ ] **Step 1: Create the MoveToModal component**

Create `app/src/renderer/components/MoveToModal.tsx`:

```typescript
import { useEffect, useState } from 'react'
import './NewItemModal.css'

interface MoveToModalProps {
  isOpen: boolean
  itemName: string
  folders: string[]              // system-relative destination folders
  onPick: (folderRel: string) => void
  onCancel: () => void
}

export default function MoveToModal({ isOpen, itemName, folders, onPick, onCancel }: MoveToModalProps) {
  const [filter, setFilter] = useState('')
  useEffect(() => { if (isOpen) setFilter('') }, [isOpen])
  if (!isOpen) return null
  const shown = folders.filter(f => f.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="new-item-overlay" onClick={onCancel}>
      <div className="new-item-modal" onClick={e => e.stopPropagation()}>
        <div className="new-item-title">Move “{itemName}” to…</div>
        <input className="new-item-input" placeholder="Filter folders" value={filter} onChange={e => setFilter(e.target.value)} />
        <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 10 }}>
          {shown.length === 0 && <div className="new-item-preview">No folders</div>}
          {shown.map(f => (
            <button key={f} className="tcm-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => onPick(f)}>{f}</button>
          ))}
        </div>
        <div className="new-item-actions"><button className="new-item-btn ghost" onClick={onCancel}>Cancel</button></div>
      </div>
    </div>
  )
}
```

(Reuses `NewItemModal.css` + `tcm-item` from `TreeContextMenu.css`, both already imported app-wide via their components.)

- [ ] **Step 2: Imports + pending state**

Add imports:

```typescript
import NewItemModal from '../components/NewItemModal'
import MoveToModal from '../components/MoveToModal'
import { scaffoldFor, ScaffoldType } from '../utils/scaffold'
```

Add state near the others:

```typescript
  type Pending =
    | { kind: 'scaffold'; type: ScaffoldType }
    | { kind: 'file'; parentAbs: string }
    | { kind: 'folder'; parentAbs: string }
    | { kind: 'rename'; absPath: string; isDir: boolean }
  const [pendingCreate, setPendingCreate] = useState<Pending | null>(null)
  const [moveSource, setMoveSource] = useState<string | null>(null)
  const [moveFolders, setMoveFolders] = useState<string[]>([])
  const canEdit = !isMainBranch && caps.isGitRepo
```

- [ ] **Step 2: Create/rename confirm handler**

Add handlers (after the draft handlers, before `return`):

```typescript
  const refreshAfterFs = async () => { setTreeRefresh(t => t + 1); await fetchGitStatus() }

  const doCreateConfirm = async (name: string) => {
    const p = pendingCreate
    setPendingCreate(null)
    if (!p) return
    const date = new Date().toISOString().slice(0, 10)
    if (p.kind === 'scaffold') {
      const { files } = scaffoldFor(p.type, name, date)
      let firstAbs = ''
      for (const f of files) {
        const abs = `${rootPath}/${f.path}`
        const res = await window.api.fs.createFile(abs, f.content)
        if (!res.ok) { showToast(res.error || "Couldn't create"); return }
        if (!firstAbs) firstAbs = abs
      }
      await refreshAfterFs()
      if (firstAbs) handleFileSelect(firstAbs)
    } else if (p.kind === 'file') {
      const abs = `${p.parentAbs}/${name.trim().endsWith('.md') ? name.trim() : `${name.trim()}.md`}`
      const res = await window.api.fs.createFile(abs, '')
      if (!res.ok) { showToast(res.error || "Couldn't create"); return }
      await refreshAfterFs(); handleFileSelect(abs)
    } else if (p.kind === 'folder') {
      const res = await window.api.fs.mkdir(`${p.parentAbs}/${name.trim()}`)
      if (!res.ok) { showToast(res.error || "Couldn't create"); return }
      await refreshAfterFs()
    } else { // rename
      const parent = p.absPath.replace(/\/[^/]+$/, '')
      const res = await window.api.fs.move(p.absPath, `${parent}/${name.trim()}`)
      if (!res.ok) { showToast(res.error || "Couldn't rename"); return }
      if (selectedFile === p.absPath) setSelectedFile(undefined)
      await refreshAfterFs()
    }
  }

  const handleMove = async (fromAbs: string, toFolderAbs: string) => {
    if (!toFolderAbs) {
      // Context-menu "Move to…" → open the folder picker
      const res = await window.api.fs.listFolders(rootPath)
      const fromRel = fromAbs.replace(rootPath + '/', '')
      // valid destinations: not the item's own folder or a descendant of it
      setMoveFolders((res.ok ? res.folders : []).filter(f => f !== fromRel && !f.startsWith(fromRel + '/')))
      setMoveSource(fromAbs)
      return
    }
    const name = fromAbs.split('/').pop()
    const res = await window.api.fs.move(fromAbs, `${toFolderAbs}/${name}`)
    if (!res.ok) { showToast(res.error || "Couldn't move"); return }
    if (selectedFile === fromAbs) setSelectedFile(undefined)
    await refreshAfterFs()
  }

  const handlePickMoveDest = async (folderRel: string) => {
    const from = moveSource
    setMoveSource(null)
    if (!from) return
    const name = from.split('/').pop()
    const res = await window.api.fs.move(from, `${rootPath}/${folderRel}/${name}`)
    if (!res.ok) { showToast(res.error || "Couldn't move"); return }
    if (selectedFile === from) setSelectedFile(undefined)
    await refreshAfterFs()
  }

  const handleDelete = async (absPath: string) => {
    const name = absPath.split('/').pop()
    if (!window.confirm(`Delete "${name}"? This can't be undone (until you Discard the draft).`)) return
    const res = await window.api.fs.delete(absPath)
    if (!res.ok) { showToast(res.error || "Couldn't delete"); return }
    if (selectedFile === absPath) { setSelectedFile(undefined); setTabs(prev => prev.filter(t => t.path !== absPath)) }
    await refreshAfterFs()
  }
```

- [ ] **Step 3: Modal title/preview + render**

Add a helper for the modal's title/preview and render it. Before `return`:

```typescript
  const modalConfig = (() => {
    const p = pendingCreate
    if (!p) return null
    if (p.kind === 'scaffold') {
      const labels = { playbook: 'New Playbook', project: 'New Project', 'sub-system': 'New Sub-system' }
      return { title: labels[p.type], previewFor: (slug: string) => `will create ${scaffoldFor(p.type, slug, '').folder}/` , initialName: '' }
    }
    if (p.kind === 'file') return { title: 'New File', previewFor: (slug: string) => `${p.parentAbs.replace(rootPath + '/', '')}/${slug}.md`, initialName: '' }
    if (p.kind === 'folder') return { title: 'New Folder', previewFor: (slug: string) => `${p.parentAbs.replace(rootPath + '/', '')}/${slug}`, initialName: '' }
    return { title: 'Rename', previewFor: (slug: string) => slug, initialName: p.absPath.split('/').pop() || '' }
  })()
```

In the JSX (near the other modals), add:

```tsx
      {modalConfig && (
        <NewItemModal
          isOpen={!!pendingCreate}
          title={modalConfig.title}
          previewFor={modalConfig.previewFor}
          initialName={modalConfig.initialName}
          onConfirm={doCreateConfirm}
          onCancel={() => setPendingCreate(null)}
        />
      )}
      <MoveToModal
        isOpen={!!moveSource}
        itemName={moveSource ? (moveSource.split('/').pop() || '') : ''}
        folders={moveFolders}
        onPick={handlePickMoveDest}
        onCancel={() => setMoveSource(null)}
      />
```

- [ ] **Step 4: Pass props to FileTree**

Update the `<FileTree ... />` element to add:

```tsx
            canEdit={canEdit}
            onNeedDraft={() => showToast('Create a draft to make changes.')}
            onNewScaffold={(type) => setPendingCreate({ kind: 'scaffold', type })}
            onNewFile={(parentAbs) => setPendingCreate({ kind: 'file', parentAbs })}
            onNewFolder={(parentAbs) => setPendingCreate({ kind: 'folder', parentAbs })}
            onRename={(absPath, isDir) => setPendingCreate({ kind: 'rename', absPath, isDir })}
            onMove={handleMove}
            onDelete={(absPath) => handleDelete(absPath)}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd .. && git add app/src/renderer/pages/SystemOverview.tsx && git commit -m "feat: content-creation orchestration (scaffold/file/folder/rename/move/delete) gated to drafts"
```

---

## Phase 3 — Verify

### Task 8: Full verification + manual smoke

- [ ] **Step 1: Everything green**

Run: `cd app && npm test && npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && npm run build`
Expected: all tests pass; no type errors; build succeeds.

- [ ] **Step 2: Manual smoke** (`cd app && npm run dev`)

On a Draft, verify the spec's success criteria:
1. "+ New" → New Playbook / Project / Sub-system → name modal shows a live slug/path preview → creates the right files from `app/templates/`.
2. Right-click a folder → New file/New folder (name modal); Rename; Move to… (folder picker); Copy path (system-relative path on clipboard); Delete (confirm).
3. Drag a file onto a folder → it moves.
4. The four canonical sections always show; an empty one says "Nothing here yet"; creating into a missing folder materializes it (no `.gitkeep`).
5. On the Live Version, "+ New" and edit actions show "Create a draft to make changes."
6. Edit a file in `app/templates/` → the next scaffold reflects it.

- [ ] **Step 3: Commit any touch-ups**

```bash
cd .. && git add -A && git commit -m "chore: content creation verified end-to-end" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** templates §1 → T1; scaffold engine §2 → T2; fs ops §3 → T3; NewItemModal §4 → T4; tree UI §5 → T5/T6; **both move methods §5** → drag-and-drop (T6) + "Move to…" picker (T3 `listFolders` + `MoveToModal` in T7); canonical sections + lazy creation §6 → T6 (sections) + T3/T7 (createFile makes parents); placement/validation §7 → T2 (`isProtectedPath`), T5/T6 (dir-only DnD/new-folder), T7 (gating + descendant guard in `handleMove`); error handling §8 → toast in T7; testing §9 → T2/T3 + manual. All covered.
- **Protected-folder enforcement:** top-level canonical folders are non-draggable-into-existence (New Folder is dir-context only, and the section headers aren't draggable items); `isProtectedPath` is available for a guard in `handleMove`/`handleDelete` if we later expose those on top-level nodes.
- **Type consistency:** `ScaffoldType` shared by scaffold.ts (T2) and SystemOverview (T7); `ContextTarget` shared by TreeContextMenu (T5) and FileTree (T6); fs method shapes identical across main/preload/env.d.ts (T3).
