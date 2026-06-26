# Content-Integrity & Degraded-Mode Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop AMP UP from corrupting user content (frontmatter loss, lossy markdown round-trip), make the app degrade gracefully to a local "just Obsidian" mode when git/GitHub aren't available, and cover the new logic with tests.

**Architecture:** Restore the invariant "the markdown file on disk is the source of truth." The editor reads/writes markdown natively via TipTap's official `@tiptap/markdown` extension. Frontmatter is parsed with `gray-matter`, held as structured data, edited through an opinionated schema-driven Properties panel, and re-attached on every write through a single writer (`useFileDocument`). The main process detects capabilities (`isGitRepo`, `gh` available/authed) and the UI disables controls it can't support, showing friendly guidance.

**Tech Stack:** Electron, React 19, TipTap 3.23 + `@tiptap/markdown`, `gray-matter`, `simple-git`, `gh` CLI, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-06-26-content-integrity-fixes-design.md`

---

## File Structure

**New files**
- `app/src/renderer/utils/frontmatterSchemas.ts` — declarative type→fields registry + `detectFileType()`.
- `app/src/renderer/utils/fileDocument.ts` — pure parse/compose around `gray-matter` (split frontmatter from body, recombine preserving unknown keys).
- `app/src/renderer/utils/markdownSerializer.ts` — headless TipTap markdown round-trip helpers + the shared extension list.
- `app/src/renderer/hooks/useFileDocument.ts` — single owner of a file's `{data, body}`, disk read/write, status.
- `app/src/renderer/components/Toast.tsx` + `Toast.css` — minimal toast/banner + context provider.
- `app/src/main/gh.ts` — `gh` path resolver + `gh auth status` parsing + capability probe.
- `app/vitest.config.ts` — test runner config.
- Test files colocated under `app/src/**/__tests__/`.

**Modified files**
- `app/src/main/index.ts` — use `gh.ts` everywhere; add `system:capabilities` IPC.
- `app/src/preload/index.ts` — expose `system.capabilities`.
- `app/src/renderer/components/FileViewer.tsx` — markdown-native, controlled body editor.
- `app/src/renderer/components/PropertiesPanel.tsx` — schema-driven, editable, controlled.
- `app/src/renderer/pages/SystemOverview.tsx` — use `useFileDocument`; wire capabilities.
- `app/src/renderer/components/StatusBar.tsx` (+ `.css`) — capability-aware disabled controls.
- `app/src/renderer/pages/Review.tsx` — shared markdown path.
- `app/src/renderer/pages/Settings.tsx` — non-git-repo notice + "Connect to GitHub" placeholder.
- `app/src/renderer/main.tsx` — wrap app in `ToastProvider`.
- `app/package.json` — deps; remove `markdown-it`, `turndown`, `@types/turndown`.

**Deleted files**
- `app/src/renderer/utils/markdown.ts`, `app/src/renderer/utils/htmlToMarkdown.ts`, `app/src/renderer/types/markdown-it.d.ts`.

---

## Phase 0 — Test infrastructure

### Task 1: Add Vitest

**Files:**
- Create: `app/vitest.config.ts`
- Create: `app/src/renderer/utils/__tests__/smoke.test.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Install dev deps**

Run: `cd app && npm install -D vitest@^3 jsdom@^25`
Expected: packages added, no errors.

- [ ] **Step 2: Create vitest config**

Create `app/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    globals: true,
  },
})
```

- [ ] **Step 3: Add test script**

In `app/package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write smoke test**

Create `app/src/renderer/utils/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('test runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run it**

Run: `cd app && npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/vitest.config.ts app/src/renderer/utils/__tests__/smoke.test.ts
git commit -m "test: add Vitest + jsdom test runner"
```

---

## Phase 1 — Frontmatter core (pure logic, TDD)

### Task 2: Schema registry + type detection

**Files:**
- Create: `app/src/renderer/utils/frontmatterSchemas.ts`
- Test: `app/src/renderer/utils/__tests__/frontmatterSchemas.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/renderer/utils/__tests__/frontmatterSchemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectFileType, getSchema } from '../frontmatterSchemas'

describe('detectFileType', () => {
  it('prefers an explicit type field', () => {
    expect(detectFileType('/any/where/notes.md', { type: 'playbook' })).toBe('playbook')
  })

  it('falls back to SKILL.md under .claude/skills', () => {
    expect(detectFileType('/repo/.claude/skills/onboarding/SKILL.md', {})).toBe('playbook')
  })

  it('does not treat other files in .claude/skills as playbooks', () => {
    expect(detectFileType('/repo/.claude/skills/onboarding/notes.md', {})).toBeNull()
  })

  it('returns null for an unrecognized file', () => {
    expect(detectFileType('/repo/docs/readme.md', {})).toBeNull()
  })
})

describe('getSchema', () => {
  it('returns ordered fields for playbook', () => {
    const fields = getSchema('playbook')!.map(f => f.key)
    expect(fields).toEqual(['name', 'description', 'process', 'status'])
  })

  it('returns null for unknown type', () => {
    expect(getSchema('nope')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/frontmatterSchemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/renderer/utils/frontmatterSchemas.ts`:

```typescript
export type Widget = 'text' | 'select' | 'tags'

export interface FieldSchema {
  key: string
  label: string
  widget: Widget
  options?: string[]
}

export const STATUS_OPTIONS = ['Draft', 'Active', 'Archived']

const SCHEMAS: Record<string, FieldSchema[]> = {
  playbook: [
    { key: 'name', label: 'Name', widget: 'text' },
    { key: 'description', label: 'Description', widget: 'text' },
    { key: 'process', label: 'Process', widget: 'text' },
    { key: 'status', label: 'Status', widget: 'select', options: STATUS_OPTIONS },
  ],
}

export function getSchema(type: string | null): FieldSchema[] | null {
  if (!type) return null
  return SCHEMAS[type] ?? null
}

/** Determine a file's type: explicit `type` frontmatter wins, else SKILL.md under .claude/skills. */
export function detectFileType(filePath: string, data: Record<string, unknown>): string | null {
  const explicit = data?.type
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()

  const normalized = filePath.replace(/\\/g, '/')
  if (/\/\.claude\/skills\/.*\/SKILL\.md$/.test(normalized) || /\/\.claude\/skills\/SKILL\.md$/.test(normalized)) {
    return 'playbook'
  }
  return null
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/frontmatterSchemas.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/frontmatterSchemas.ts app/src/renderer/utils/__tests__/frontmatterSchemas.test.ts
git commit -m "feat: frontmatter schema registry + type detection"
```

### Task 3: Frontmatter parse/compose (unknown-key retention)

**Files:**
- Create: `app/src/renderer/utils/fileDocument.ts`
- Test: `app/src/renderer/utils/__tests__/fileDocument.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/renderer/utils/__tests__/fileDocument.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseDocument, composeDocument } from '../fileDocument'

describe('parseDocument', () => {
  it('splits frontmatter from body', () => {
    const raw = '---\nname: Onboarding\nstatus: Active\n---\n# Hello\n\nBody.\n'
    const doc = parseDocument(raw)
    expect(doc.data).toEqual({ name: 'Onboarding', status: 'Active' })
    expect(doc.body.trim()).toBe('# Hello\n\nBody.'.trim())
  })

  it('handles files with no frontmatter', () => {
    const doc = parseDocument('# Just a title\n')
    expect(doc.data).toEqual({})
    expect(doc.body.trim()).toBe('# Just a title')
  })
})

describe('composeDocument', () => {
  it('round-trips, preserving unknown keys', () => {
    const raw = '---\nname: Onboarding\ncustom_field: keep-me\n---\nBody text.\n'
    const doc = parseDocument(raw)
    const out = composeDocument({ ...doc.data, name: 'Renamed' }, doc.body)
    const reparsed = parseDocument(out)
    expect(reparsed.data.name).toBe('Renamed')
    expect(reparsed.data.custom_field).toBe('keep-me')
  })

  it('emits no frontmatter fence when data is empty', () => {
    const out = composeDocument({}, '# Title\n')
    expect(out.startsWith('---')).toBe(false)
    expect(out).toContain('# Title')
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/fileDocument.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/renderer/utils/fileDocument.ts`:

```typescript
import matter from 'gray-matter'

export interface FileDocument {
  data: Record<string, unknown>
  body: string
}

export function parseDocument(raw: string): FileDocument {
  const parsed = matter(raw)
  return { data: { ...parsed.data }, body: parsed.content }
}

/** Recombine frontmatter + body. Empty data => no frontmatter fence. */
export function composeDocument(data: Record<string, unknown>, body: string): string {
  const hasData = data && Object.keys(data).length > 0
  if (!hasData) {
    return body.endsWith('\n') ? body : body + '\n'
  }
  // matter.stringify writes the fence + a trailing newline after body.
  return matter.stringify(body, data)
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/fileDocument.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/fileDocument.ts app/src/renderer/utils/__tests__/fileDocument.test.ts
git commit -m "feat: gray-matter parse/compose with unknown-key retention"
```

---

## Phase 2 — Markdown round-trip

### Task 4: Markdown-native serialization + remove HTML pipeline

**Files:**
- Create: `app/src/renderer/utils/markdownSerializer.ts`
- Test: `app/src/renderer/utils/__tests__/markdownSerializer.test.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Install the extension**

Run: `cd app && npm install @tiptap/markdown`
Expected: added, peer-compatible with @tiptap 3.23.

- [ ] **Step 2: Implement shared extensions + helpers**

Create `app/src/renderer/utils/markdownSerializer.ts`:

```typescript
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'

/** Single source of truth for the editor's extension set (used by FileViewer, Review, and tests). */
export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Markdown,
  ]
}

/** Headless round-trip: markdown -> doc -> markdown. Used in tests. */
export function roundTrip(markdown: string): string {
  const editor = new Editor({
    extensions: editorExtensions(),
    content: markdown,
    contentType: 'markdown',
  })
  const out = editor.getMarkdown()
  editor.destroy()
  return out
}
```

> Note: if `editor.getMarkdown()` is not present on the installed build, substitute `editor.markdown.serialize(editor.getJSON())` — the round-trip test in Step 3 will reveal which the package exposes. Update both this file and `FileViewer`/`Review` to match.

- [ ] **Step 3: Write round-trip tests**

Create `app/src/renderer/utils/__tests__/markdownSerializer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { roundTrip } from '../markdownSerializer'

const cases: Array<[string, string]> = [
  ['heading', '# Title'],
  ['bold', 'This is **bold** text'],
  ['italic', 'This is *italic* text'],
  ['link', '[label](https://example.com)'],
  ['bullets', '- one\n- two\n- three'],
  ['ordered', '1. one\n2. two'],
  ['code block', '```js\nconst x = 1\n```'],
  ['blockquote', '> quoted'],
]

describe('markdown round-trip', () => {
  it.each(cases)('preserves %s', (_name, md) => {
    const out = roundTrip(md).trim()
    // Normalize trailing whitespace only; content must survive.
    expect(out).toContain(md.split('\n')[0].replace(/^[#>-]\s*/, '').slice(0, 8))
    expect(out.length).toBeGreaterThan(0)
  })

  it('does not HTML-escape or wrap content', () => {
    const out = roundTrip('Plain paragraph.')
    expect(out).not.toContain('<p>')
    expect(out.trim()).toBe('Plain paragraph.')
  })
})
```

- [ ] **Step 4: Run, verify pass (and confirm the serialize API)**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/markdownSerializer.test.ts`
Expected: PASS. If it errors on `getMarkdown`, apply the Step 2 note and re-run.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/markdownSerializer.ts app/src/renderer/utils/__tests__/markdownSerializer.test.ts app/package.json app/package-lock.json
git commit -m "feat: markdown-native TipTap serialization + round-trip tests"
```

---

## Phase 3 — Editor integration

### Task 5: `useFileDocument` hook (single writer)

**Files:**
- Create: `app/src/renderer/hooks/useFileDocument.ts`

- [ ] **Step 1: Implement the hook**

Create `app/src/renderer/hooks/useFileDocument.ts`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { parseDocument, composeDocument } from '../utils/fileDocument'

export type WriteStatus = 'idle' | 'writing' | 'written'

/**
 * Owns one file's frontmatter `data` + markdown `body`, and is the ONLY writer to disk.
 * Both the editor (body) and the Properties panel (data) feed changes here so they can't
 * clobber each other — every write re-attaches the full frontmatter.
 */
export function useFileDocument(filePath: string | undefined, readOnly: boolean) {
  const [data, setData] = useState<Record<string, unknown>>({})
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<WriteStatus>('idle')
  const lastWritten = useRef<string>('')
  const loading = useRef(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  // Load on file change.
  useEffect(() => {
    if (!filePath) return
    loading.current = true
    window.api.fs.readFile(filePath).then(res => {
      if (res.ok && res.content !== undefined) {
        const doc = parseDocument(res.content)
        lastWritten.current = res.content
        setData(doc.data)
        setBody(doc.body)
      }
      // allow writes again on next tick
      setTimeout(() => { loading.current = false }, 0)
    })
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [filePath])

  const write = useCallback((nextData: Record<string, unknown>, nextBody: string) => {
    if (!filePath || readOnly || loading.current) return
    const composed = composeDocument(nextData, nextBody)
    if (composed === lastWritten.current) return
    if (debounce.current) clearTimeout(debounce.current)
    setStatus('writing')
    debounce.current = setTimeout(async () => {
      const result = await window.api.fs.writeFile(filePath, composed)
      if (result.ok) {
        lastWritten.current = composed
        setStatus('written')
        setTimeout(() => setStatus('idle'), 1500)
      } else {
        setStatus('idle')
      }
    }, 600)
  }, [filePath, readOnly])

  const updateBody = useCallback((nextBody: string) => {
    setBody(nextBody)
    write(data, nextBody)
  }, [data, write])

  const updateData = useCallback((nextData: Record<string, unknown>) => {
    setData(nextData)
    write(nextData, body)
  }, [body, write])

  return { data, body, status, updateBody, updateData }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit`
Expected: no errors in `useFileDocument.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/src/renderer/hooks/useFileDocument.ts
git commit -m "feat: useFileDocument hook as single disk writer"
```

### Task 6: Rewire FileViewer to markdown-native + controlled body

**Files:**
- Modify: `app/src/renderer/components/FileViewer.tsx`

- [ ] **Step 1: Replace editor config + load/write logic**

In `FileViewer.tsx`, replace the imports of `markdownToHtml`/`htmlToMarkdown` and the StarterKit/extensions list with the shared set, drive content from a `body` prop, and report changes up. The component becomes controlled: it no longer reads or writes the file itself.

Replace the top imports:

```typescript
import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from '../utils/markdownSerializer'
import './FileViewer.css'
```

Replace the props interface and signature:

```typescript
interface FileViewerProps {
  filePath: string | undefined
  rootPath?: string
  readOnly?: boolean
  body: string
  onBodyChange: (markdown: string) => void
  writeStatus: 'idle' | 'writing' | 'written'
  onToggleProperties?: () => void
  propsOpen?: boolean
}

export default function FileViewer({
  filePath, rootPath, readOnly, body, onBodyChange, writeStatus, onToggleProperties, propsOpen,
}: FileViewerProps) {
```

Configure the editor and sync from `body`:

```typescript
  const editor = useEditor({
    extensions: editorExtensions(),
    editable: !readOnly,
    content: '',
    onUpdate: ({ editor: ed }) => {
      if (readOnly) return
      onBodyChange(ed.getMarkdown())
    },
  })

  useEffect(() => { editor?.setEditable(!readOnly) }, [readOnly, editor])

  // Load body into the editor when the file (or its loaded content) changes.
  useEffect(() => {
    if (!editor) return
    const current = editor.getMarkdown()
    if (current.trim() === body.trim()) return
    editor.commands.setContent(body, { contentType: 'markdown' })
  }, [body, editor])
```

Remove: `writeToDisk`, `currentFilePath`, `isLoadingContent`, `debounceTimer`, `lastWrittenMarkdown`, `onContentLoad`, the `fs.stat`/`fs.readFile` effects, and the `<pre><code>` non-markdown branch (non-markdown files are handled by the parent passing raw text as body). Keep the header/title/meta JSX, but source `writeStatus` from props.

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit`
Expected: errors only in `SystemOverview.tsx` (fixed in Task 7), none in `FileViewer.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/src/renderer/components/FileViewer.tsx
git commit -m "refactor: FileViewer is a controlled markdown editor"
```

### Task 7: Wire SystemOverview to the hook + editable Properties

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`
- Modify: `app/src/renderer/components/PropertiesPanel.tsx`

- [ ] **Step 1: Use the hook in SystemOverview**

In `SystemOverview.tsx`, replace `rawContent` state and the `onContentLoad` wiring with the hook:

```typescript
import { useFileDocument } from '../hooks/useFileDocument'
```

Inside the component, after `selectedFile`/`isMainBranch` exist:

```typescript
  const { data, body, status: writeStatus, updateBody, updateData } = useFileDocument(selectedFile, isMainBranch)
```

Update the JSX to pass the new props and drop `rawContent`:

```tsx
          <FileViewer
            filePath={selectedFile}
            rootPath={rootPath}
            readOnly={isMainBranch}
            body={body}
            onBodyChange={updateBody}
            writeStatus={writeStatus}
            onToggleProperties={() => setPropsOpen(!propsOpen)}
            propsOpen={propsOpen}
          />
          <PropertiesPanel
            isOpen={propsOpen}
            onClose={() => setPropsOpen(false)}
            filePath={selectedFile}
            data={data}
            onChange={updateData}
            readOnly={isMainBranch}
          />
```

Remove the `const [rawContent, setRawContent] = useState('')` line.

- [ ] **Step 2: Make PropertiesPanel schema-driven + editable**

Replace `app/src/renderer/components/PropertiesPanel.tsx` body with a schema-driven, controlled implementation:

```typescript
import './PropertiesPanel.css'
import { detectFileType, getSchema, FieldSchema } from '../utils/frontmatterSchemas'

interface PropertiesPanelProps {
  isOpen: boolean
  onClose: () => void
  filePath: string | undefined
  data: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  readOnly?: boolean
}

export default function PropertiesPanel({ isOpen, onClose, filePath, data, onChange, readOnly }: PropertiesPanelProps) {
  const type = filePath ? detectFileType(filePath, data) : null
  const schema = getSchema(type)

  const setField = (key: string, value: unknown) => {
    onChange({ ...data, [key]: value })
  }

  const renderField = (f: FieldSchema) => {
    const value = data[f.key]
    if (f.widget === 'select') {
      return (
        <select className="prop-select" value={String(value ?? '')} disabled={readOnly}
          onChange={e => setField(f.key, e.target.value)}>
          <option value="">None</option>
          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (f.widget === 'tags') {
      const tags = Array.isArray(value) ? (value as string[]) : []
      return (
        <input className="prop-input" type="text" value={tags.join(', ')} disabled={readOnly}
          onChange={e => setField(f.key, e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
      )
    }
    return (
      <input className="prop-input" type="text" value={String(value ?? '')} disabled={readOnly}
        onChange={e => setField(f.key, e.target.value)} />
    )
  }

  const fileName = filePath?.split('/').pop() || ''

  return (
    <div className={`properties-panel ${isOpen ? 'open' : ''}`}>
      <div className="properties-header">
        <span className="properties-title">Properties</span>
        <button className="properties-close" onClick={onClose}>&times;</button>
      </div>
      <div className="properties-body">
        {schema ? (
          schema.map(f => (
            <div className="prop-group" key={f.key}>
              <div className="prop-label">{f.label}</div>
              {renderField(f)}
            </div>
          ))
        ) : (
          <div className="prop-empty">
            No properties for this file.
            <div style={{ marginTop: '8px', fontSize: '11px' }}>
              Properties appear for known file types (e.g. playbooks).
            </div>
          </div>
        )}
        <div className="prop-divider" />
        <div className="prop-group">
          <div className="prop-label">File Info</div>
          <div className="prop-meta">{fileName}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `cd app && npm run dev`. Connect a system, open a `SKILL.md` under `.claude/skills/`. Confirm: properties show name/description/process/status; editing Status writes YAML back (check the file on disk); editing body produces a clean diff; a file with an extra frontmatter key keeps that key after an edit.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/pages/SystemOverview.tsx app/src/renderer/components/PropertiesPanel.tsx
git commit -m "feat: schema-driven editable Properties via single-writer hook"
```

### Task 8: Share markdown path in Review

**Files:**
- Modify: `app/src/renderer/pages/Review.tsx`

- [ ] **Step 1: Replace markdown-it usage**

In `Review.tsx`, remove `import { markdownToHtml } from '../utils/markdown'` and the inline StarterKit config. Use the shared extensions and set markdown content directly:

```typescript
import { editorExtensions } from '../utils/markdownSerializer'
```

```typescript
  const editor = useEditor({
    extensions: editorExtensions(),
    editable: false,
    content: '',
  })
```

Wherever the Final view currently does `editor.commands.setContent(markdownToHtml(content))`, replace with:

```typescript
  editor.commands.setContent(content, { contentType: 'markdown' })
```

- [ ] **Step 2: Build**

Run: `cd app && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/renderer/pages/Review.tsx
git commit -m "refactor: Review uses shared markdown-native rendering"
```

### Task 9: Delete the dead HTML pipeline

**Files:**
- Delete: `app/src/renderer/utils/markdown.ts`, `app/src/renderer/utils/htmlToMarkdown.ts`, `app/src/renderer/types/markdown-it.d.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Remove files + deps**

```bash
cd app
rm src/renderer/utils/markdown.ts src/renderer/utils/htmlToMarkdown.ts src/renderer/types/markdown-it.d.ts
npm uninstall markdown-it turndown @types/turndown
```

- [ ] **Step 2: Verify nothing references them**

Run: `cd app && grep -rn "markdown-it\|turndown\|utils/markdown\|htmlToMarkdown" src || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Build + test**

Run: `cd app && npm run build && npm test`
Expected: build OK, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove markdown-it/turndown HTML round-trip"
```

---

## Phase 4 — Capabilities & degraded modes

### Task 10: `gh` resolver + capability probe (main)

**Files:**
- Create: `app/src/main/gh.ts`
- Test: `app/src/main/__tests__/gh.test.ts`
- Modify: `app/vitest.config.ts` (ensure `src/main/**` tests run under node env)

- [ ] **Step 1: Split test envs**

Replace `app/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['src/main/**', 'node'],
      ['src/renderer/**', 'jsdom'],
    ],
  },
})
```

- [ ] **Step 2: Write failing tests for the pure parts**

Create `app/src/main/__tests__/gh.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { pickGhPath, isAuthedFromStatus } from '../gh'

describe('pickGhPath', () => {
  it('returns the first existing candidate', () => {
    const exists = (p: string) => p === '/usr/local/bin/gh'
    expect(pickGhPath(['/opt/homebrew/bin/gh', '/usr/local/bin/gh'], exists)).toBe('/usr/local/bin/gh')
  })

  it('returns null when none exist', () => {
    expect(pickGhPath(['/a/gh', '/b/gh'], () => false)).toBeNull()
  })
})

describe('isAuthedFromStatus', () => {
  it('true when logged in', () => {
    expect(isAuthedFromStatus(0, 'github.com\n  ✓ Logged in to github.com account user')).toBe(true)
  })
  it('false on non-zero exit', () => {
    expect(isAuthedFromStatus(1, 'You are not logged into any GitHub hosts.')).toBe(false)
  })
})
```

- [ ] **Step 3: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/gh.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `app/src/main/gh.ts`:

```typescript
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

/** Run gh with resolved path; throws a structured error when unavailable. */
export async function runGh(args: string[], cwd: string, maxBuffer = 10 * 1024 * 1024) {
  const gh = await resolveGh()
  if (!gh) {
    const err = new Error('gh-unavailable') as Error & { code: string }
    err.code = 'GH_UNAVAILABLE'
    throw err
  }
  return exec(gh, args, { cwd, maxBuffer })
}
```

- [ ] **Step 5: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/gh.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Replace hardcoded gh calls + add capability IPC**

In `app/src/main/index.ts`: remove the per-handler `execFile`/`promisify` blocks and the literal `/opt/homebrew/bin/gh` (8 sites); import and call `runGh` instead. Example transform for `git:listPRs`:

```typescript
import { runGh, resolveGh, ghAuthed } from './gh'
// ...
ipcMain.handle('git:listPRs', async (_event, repoPath: string) => {
  try {
    const result = await runGh(['pr', 'list', '--json',
      'number,title,state,author,createdAt,headRefName,reviewDecision,url,additions,deletions,changedFiles',
      '--limit', '20'], repoPath)
    return { ok: true, prs: JSON.parse(result.stdout.trim()) }
  } catch {
    return { ok: true, prs: [] }
  }
})
```

Apply the same substitution to `git:createPR`, `git:prStatus`, `git:checkMerged`, `git:prDiff`, `git:prFileDiff`, `git:reviewPR`.

Add a capabilities handler:

```typescript
import { simpleGit } from 'simple-git'

ipcMain.handle('system:capabilities', async (_event, repoPath: string) => {
  let isGitRepo = false
  try { isGitRepo = await simpleGit(repoPath).checkIsRepo() } catch { isGitRepo = false }
  const available = await ghAvailable()
  const authed = available ? await ghAuthed() : false
  return { ok: true, isGitRepo, ghAvailable: available, ghAuthed: authed }
})
```

- [ ] **Step 7: Build + test**

Run: `cd app && npm run build && npm test`
Expected: build OK, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/src/main app/vitest.config.ts
git commit -m "feat: gh resolver + system capability probe"
```

### Task 11: Expose capabilities in preload

**Files:**
- Modify: `app/src/preload/index.ts`
- Modify: `app/src/renderer/env.d.ts`

- [ ] **Step 1: Add the bridge method**

In `app/src/preload/index.ts`, add under the `api` object:

```typescript
  system: {
    capabilities: (repoPath: string) => ipcRenderer.invoke('system:capabilities', repoPath),
  },
```

- [ ] **Step 2: Add the type**

In `app/src/renderer/env.d.ts`, add to the `api` interface a `system` member:

```typescript
    system: {
      capabilities: (repoPath: string) => Promise<{
        ok: boolean; isGitRepo: boolean; ghAvailable: boolean; ghAuthed: boolean
      }>
    }
```

- [ ] **Step 3: Build**

Run: `cd app && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/preload/index.ts app/src/renderer/env.d.ts
git commit -m "feat: expose system.capabilities to renderer"
```

### Task 12: Capability-aware StatusBar + SystemOverview wiring

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`
- Modify: `app/src/renderer/components/StatusBar.tsx` (+ `StatusBar.css`)

- [ ] **Step 1: Fetch capabilities in SystemOverview**

Add state + fetch (alongside `fetchGitStatus`):

```typescript
  const [caps, setCaps] = useState({ isGitRepo: true, ghAvailable: true, ghAuthed: true })

  useEffect(() => {
    if (!rootPath) return
    window.api.system.capabilities(rootPath).then(r => {
      if (r.ok) setCaps({ isGitRepo: r.isGitRepo, ghAvailable: r.ghAvailable, ghAuthed: r.ghAuthed })
    })
  }, [rootPath])
```

Pass derived mode flags to StatusBar:

```tsx
        <StatusBar
          /* ...existing props... */
          canUseGit={caps.isGitRepo}
          canUseGitHub={caps.isGitRepo && caps.ghAuthed}
          onNeedGitHub={() => showToast('Connect to GitHub in Settings to publish and review.')}
          onNeedGit={() => showToast("This folder isn't connected to version control.")}
        />
```

(`showToast` comes from Task 14.)

- [ ] **Step 2: Gate controls in StatusBar**

In `StatusBar.tsx`, extend the props interface with `canUseGit: boolean; canUseGitHub: boolean; onNeedGitHub: () => void; onNeedGit: () => void`. For each action button, disable + redirect:

- Save / New Draft / Switch / Discard: `disabled={!canUseGit}`; if a disabled local-git control is clicked, call `onNeedGit()`.
- Publish (and any Inbox/Review affordance here): `disabled={!canUseGitHub}`; on disabled click call `onNeedGitHub()`.

Concretely, wrap the publish handler:

```tsx
<button
  className={`status-action ${!canUseGitHub ? 'disabled' : ''}`}
  onClick={() => canUseGitHub ? onPublish() : onNeedGitHub()}
>
  Publish
</button>
```

Apply the analogous pattern to Save/New Draft/Switch/Discard using `canUseGit`/`onNeedGit`.

- [ ] **Step 3: Disabled styling**

In `StatusBar.css`, add:

```css
.status-action.disabled {
  opacity: 0.45;
  cursor: default;
}
```

- [ ] **Step 4: Build + manual verify**

Run: `cd app && npm run build`. Then with `gh` temporarily off PATH (or unauthed), `npm run dev`: editing works; Publish is greyed and shows the GitHub toast; connecting a non-git folder greys all git controls.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/pages/SystemOverview.tsx app/src/renderer/components/StatusBar.tsx app/src/renderer/components/StatusBar.css
git commit -m "feat: capability-aware controls with degraded modes"
```

### Task 13: Non-git-repo notice in Settings + connect flow

**Files:**
- Modify: `app/src/renderer/pages/Settings.tsx`

- [ ] **Step 1: Check on folder connect**

In `Settings.tsx`, after a folder is selected/assigned to a system, probe capabilities and surface a notice when it isn't a git repo:

```typescript
  const result = await window.api.dialog.selectFolder()
  if (result.ok && result.path) {
    // ...existing assignment...
    const caps = await window.api.system.capabilities(result.path)
    if (caps.ok && !caps.isGitRepo) {
      showToast("Connected for local editing. This folder isn't a git repository, so publishing and review are unavailable.")
    } else if (caps.ok && !caps.ghAuthed) {
      showToast('Connected. Sign in under "Connect to GitHub" to publish and review.')
    }
  }
```

- [ ] **Step 2: Add a "Connect to GitHub" placeholder entry**

Add a row/button in Settings labeled "Connect to GitHub" that, for now, shows: `showToast('GitHub sign-in is coming soon. For now, install GitHub CLI and run: gh auth login.')`. (The full walkthrough wizard is MVP-planning scope.)

- [ ] **Step 3: Build + commit**

Run: `cd app && npm run build`

```bash
git add app/src/renderer/pages/Settings.tsx
git commit -m "feat: non-git-repo notice + Connect to GitHub placeholder"
```

---

## Phase 5 — Error surfacing

### Task 14: Toast provider + wire high-stakes paths

**Files:**
- Create: `app/src/renderer/components/Toast.tsx`, `app/src/renderer/components/Toast.css`
- Modify: `app/src/renderer/main.tsx`
- Modify: `app/src/renderer/pages/SystemOverview.tsx` (replace `alert(...)` on Publish/Switch/Discard/Draft failures)

- [ ] **Step 1: Implement toast context**

Create `app/src/renderer/components/Toast.tsx`:

```typescript
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import './Toast.css'

interface ToastCtx { showToast: (msg: string) => void }
const Ctx = createContext<ToastCtx>({ showToast: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const showToast = useCallback((m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 4000)
  }, [])
  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {msg && <div className="amp-toast">{msg}</div>}
    </Ctx.Provider>
  )
}
```

Create `app/src/renderer/components/Toast.css`:

```css
.amp-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #2A1A33;
  color: #F5F0EB;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  z-index: 1000;
  max-width: 480px;
}
```

- [ ] **Step 2: Wrap the app**

In `app/src/renderer/main.tsx`, wrap `<App />` with `<ToastProvider>`:

```tsx
import { ToastProvider } from './components/Toast'
// ...
root.render(<ToastProvider><App /></ToastProvider>)
```

- [ ] **Step 3: Use it in SystemOverview**

Add `const { showToast } = useToast()` and replace each `alert(...)` on the failure paths (publish failed, switch failed, archive failed, create-draft failed) with `showToast(...)` carrying the same message.

- [ ] **Step 4: Build + commit**

Run: `cd app && npm run build`

```bash
git add app/src/renderer/components/Toast.tsx app/src/renderer/components/Toast.css app/src/renderer/main.tsx app/src/renderer/pages/SystemOverview.tsx
git commit -m "feat: minimal toast + replace alert() on key failures"
```

---

## Phase 6 — Final verification

### Task 15: Full build + test + manual smoke

- [ ] **Step 1: Everything green**

Run: `cd app && npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 2: Manual smoke against a real repo**

`npm run dev`, then verify each success criterion from the spec:
1. Edit a file with frontmatter → all keys intact (incl. one not in the schema).
2. Edit a playbook's Status in Properties → correct YAML on disk.
3. A normal body edit → minimal git diff (no reformatting churn).
4. With `gh` absent → app opens/browses/edits; GitHub controls greyed + explained; no crash.
5. Connect a non-git folder → Local-only mode + notice.
6. `npm test` covers frontmatter, markdown round-trip, type detection, gh resolver.

- [ ] **Step 3: Commit any final touch-ups**

```bash
git add -A
git commit -m "chore: content-integrity fixes verified end-to-end"
```

---

## Self-Review Notes (author)

- **Spec coverage:** §1 markdown round-trip → Tasks 4,6,8,9. §2 frontmatter+Properties → Tasks 2,3,5,6,7. §3 gh/capabilities/modes → Tasks 10,11,12. §3d non-git path → Task 13. §4 errors → Task 14. §5 tests → Tasks 1–4,10 + Task 15. All covered.
- **API risk flagged:** the `getMarkdown()` vs `editor.markdown.serialize()` name is verified by the Task 4 round-trip test before it's relied on downstream.
- **Type consistency:** `useFileDocument` returns `{ data, body, status, updateBody, updateData }`; consumers in Tasks 6–7 use exactly those. `system.capabilities` shape is identical in main (Task 10), preload (Task 11), and consumers (Tasks 12–13).
- **Deferred (not in plan, by design):** OAuth onboarding wizard, packaging/signing/auto-update, shareable team config, reviewer mapping, wikilinks.
