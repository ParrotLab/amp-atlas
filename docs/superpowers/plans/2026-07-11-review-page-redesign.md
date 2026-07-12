# Review Page Redesign — Implementation Plan (Part 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PR review page into a warm, role-aware experience — reviewer mode (mark reviewed → explicit Approve / Request changes) and author read-only mode (reviewer feedback, optional description, Make edits / Publish) — matching the redesigned dashboard/inbox.

**Architecture:** Keep the existing data-loading core in `Review.tsx` (TipTap read-only render, `prDiff`/`prFileDiff`/`prFileContent`, the file accordion) and rework the presentation: a system-chip header, optional description, reviewer-feedback callout, plain-language "Updated version / What changed" toggle, and a sticky action bar whose contents depend on whether the viewer is the PR author. One new backend capability (`latestReview`) supplies the author's feedback text.

**Tech Stack:** React + TypeScript (Electron renderer), TipTap, GitHub REST (main), Vitest.

**Scope note:** This is Part 2. Part 1 (Inbox + `listPRs` fields + `mergePR`) is already shipped. The Inbox's Review/View buttons already navigate here (`/review/:systemId/:prNumber`).

## Global Constraints

- **WIP isolation.** Confirm each target file is clean (`git status --short <file>`) before editing; do not edit the parallel structural work. `SystemIcons.tsx` is import-only.
- **No emoji.** SVG icons from `components/SystemIcons.tsx` (inline chevron is fine, it already exists here).
- **Design tokens & reuse:** `softTint(primaryColor(gradient))` chip, real `Badge` component, tokens from `styles/tokens.css`.
- **Plain language, no git jargon:** Review, Approve, Request changes, Make edits, Publish, Updated version, What changed, In review, Changes requested, Approved. Never "PR"/"merge"/"branch" in user copy.
- **Code style:** no semicolons, single quotes, 2-space indent — match the file.
- **Role model:** author viewing own PR → read-only (no approve controls); reviewer → approve controls. Approve = sign-off; Publish is separate (author). Approve allows an optional note; Request changes requires a note.

## File Structure

**Modify:**
- `app/src/main/github.ts` — add `latestReview`.
- `app/src/main/index.ts` — add `git:latestReview` handler.
- `app/src/preload/index.ts` — add `git.latestReview` bridge.
- `app/src/renderer/env.d.ts` — add `latestReview` type.
- `app/src/renderer/pages/Review.tsx` — role-aware redesign (full rewrite).
- `app/src/renderer/pages/Review.css` — full rewrite.

**Test command (run from `app/`):** `npx vitest run <path>` · **Scoped typecheck:** `npx tsc --noEmit 2>&1 | grep -E '<file>'`

---

## Task 1: `latestReview` capability (author feedback)

**Files:**
- Modify: `app/src/main/github.ts` (add `latestReview`)
- Modify: `app/src/main/index.ts` (add handler)
- Modify: `app/src/preload/index.ts` (add bridge)
- Modify: `app/src/renderer/env.d.ts` (add type)

**Interfaces:**
- Produces: `window.api.git.latestReview(repoPath, prNumber) => Promise<{ ok: boolean; review: { state: string; body: string; authorName: string } | null; error?: string }>` — the most recent decisive review (APPROVED or CHANGES_REQUESTED) with its note and author display name, or `null` if none.

- [ ] **Step 1: Add the github function**

Append to `app/src/main/github.ts` (reuses the existing `resolveUserName` helper in this file):

```ts
export async function latestReview(repoPath: string, num: number) {
  const { owner, repo } = await ownerRepo(repoPath)
  const reviews = await gh(`/repos/${owner}/${repo}/pulls/${num}/reviews`) as { state: string; body: string; user: { login: string } }[]
  const decisive = [...reviews].reverse().find(r => r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED')
  if (!decisive) return null
  return { state: decisive.state, body: decisive.body || '', authorName: await resolveUserName(decisive.user.login) }
}
```

> Verify `resolveUserName` exists in `github.ts` first: `grep -n 'function resolveUserName' app/src/main/github.ts`. If it's absent, replace `await resolveUserName(decisive.user.login)` with `decisive.user.login`.

- [ ] **Step 2: Add the IPC handler**

In `app/src/main/index.ts`, near the other `git:` handlers (e.g. after `git:mergePR`), add:

```ts
ipcMain.handle('git:latestReview', async (_event, repoPath: string, num: number) => {
  try { return { ok: true, review: await github.latestReview(repoPath, num) } }
  catch (error) { logError('latestReview', error); return { ok: false, review: null, error: String(error) } }
})
```

- [ ] **Step 3: Add the preload bridge**

In `app/src/preload/index.ts`, in the `git:` object (near `mergePR`), add:

```ts
    latestReview: (repoPath: string, prNumber: number) => ipcRenderer.invoke('git:latestReview', repoPath, prNumber),
```

- [ ] **Step 4: Add the renderer type**

In `app/src/renderer/env.d.ts`, in the `git:` block (near `mergePR`), add:

```ts
    latestReview: (repoPath: string, prNumber: number) => Promise<{ ok: boolean; review: { state: string; body: string; authorName: string } | null; error?: string }>
```

- [ ] **Step 5: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'github\.ts|index\.ts|preload|env\.d\.ts' || echo "(clean)"`
Expected: `(clean)`.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/github.ts app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts
git commit -m "feat(review): add latestReview capability (author feedback)"
```

---

## Task 2: Role-aware Review page (rewrite)

**Files:**
- Modify: `app/src/renderer/pages/Review.tsx` (full rewrite)
- Modify: `app/src/renderer/pages/Review.css` (full rewrite)

**Interfaces:**
- Consumes: `latestReview` (Task 1); `mergePR`, `switchBranch`, `listPRs` (existing); `prDiff`, `prFileDiff`, `prFileContent`, `reviewPR` (existing); `primaryColor`/`softTint` (`utils/appearance`); `iconMap`/`BookIcon` (`SystemIcons`); `Badge`/`BadgeVariant` (`components/Badge`); `useProfile` (`hooks/useProfile`).

- [ ] **Step 1: Rewrite `Review.tsx`**

Replace the entire contents of `app/src/renderer/pages/Review.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { getSystem } from '../utils/systemStore'
import { editorExtensions } from '../utils/markdownSerializer'
import { parseDocument } from '../utils/fileDocument'
import { useOnline } from '../hooks/useOnline'
import { useProfile } from '../hooks/useProfile'
import { iconMap, BookIcon } from '../components/SystemIcons'
import { primaryColor, softTint } from '../utils/appearance'
import Badge, { BadgeVariant } from '../components/Badge'
import './Review.css'

interface DiffLine { type: string; content: string }
interface PRInfo {
  title: string
  author: { login: string; name: string }
  createdAt: string
  reviewDecision: string | null
  url: string
  body: string
  headRefName: string
}
interface Feedback { state: string; body: string; authorName: string }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  return `${days}d ago`
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 140ms ease' }}>
      <path d="M7 5l6 5-6 5" />
    </svg>
  )
}

export default function Review() {
  const { systemId, prNumber } = useParams<{ systemId: string; prNumber: string }>()
  const navigate = useNavigate()
  const profile = useProfile()
  const [pr, setPr] = useState<PRInfo | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [fileDiffs, setFileDiffs] = useState<Record<string, DiffLine[]>>({})
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [viewMode, setViewMode] = useState<Record<string, 'changes' | 'final'>>({})
  const [reviewedFiles, setReviewedFiles] = useState<Set<string>>(new Set())
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [action, setAction] = useState<'approve' | 'request-changes' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const online = useOnline()

  const system = systemId ? getSystem(systemId) : undefined
  const repoPath = system?.folderPath || ''
  const prNum = parseInt(prNumber || '0')
  const isAuthor = !!pr && !!profile.login && pr.author.login === profile.login

  const editor = useEditor({ extensions: editorExtensions(), editable: false, content: '' })

  useEffect(() => {
    if (!repoPath || !prNum) return
    window.api.git.listPRs(repoPath).then(result => {
      if (result.ok) {
        const found = result.prs.find(p => p.number === prNum)
        if (found) setPr({ title: found.title, author: found.author, createdAt: found.createdAt, reviewDecision: found.reviewDecision, url: found.url, body: found.body, headRefName: found.headRefName })
      }
    })
    window.api.git.prDiff(repoPath, prNum).then(result => {
      if (result.ok && result.files.length > 0) { setFiles(result.files); setExpandedFile(result.files[0]) }
    })
    window.api.git.latestReview(repoPath, prNum).then(result => {
      if (result.ok && result.review) setFeedback(result.review)
    })
  }, [repoPath, prNum])

  const getViewMode = (file: string) => viewMode[file] || 'final'

  // Load diff + content when a file is expanded (cached).
  useEffect(() => {
    if (!expandedFile || !repoPath || !prNum) return
    if (!fileDiffs[expandedFile]) {
      window.api.git.prFileDiff(repoPath, prNum, expandedFile).then(result => {
        if (result.ok) setFileDiffs(prev => ({ ...prev, [expandedFile]: result.lines }))
      })
    }
    if (!fileContents[expandedFile]) {
      window.api.git.prFileContent(repoPath, prNum, expandedFile).then(result => {
        if (result.ok) {
          setFileContents(prev => ({ ...prev, [expandedFile]: result.content }))
          if (getViewMode(expandedFile) === 'final' && editor) {
            const isMarkdown = expandedFile.endsWith('.md') || expandedFile.endsWith('.mdx')
            if (isMarkdown) editor.commands.setContent(parseDocument(result.content).body, { contentType: 'markdown' })
            else editor.commands.setContent(`<pre><code>${result.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
          }
        }
      })
    }
  }, [expandedFile, repoPath, prNum])

  // Update TipTap when switching to the Updated-version view.
  useEffect(() => {
    if (!expandedFile || !editor) return
    const mode = getViewMode(expandedFile)
    const content = fileContents[expandedFile]
    if (mode === 'final' && content) {
      const isMarkdown = expandedFile.endsWith('.md') || expandedFile.endsWith('.mdx')
      if (isMarkdown) editor.commands.setContent(parseDocument(content).body, { contentType: 'markdown' })
      else editor.commands.setContent(`<pre><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    }
  }, [viewMode, expandedFile, fileContents, editor])

  const toggleFile = (file: string) => setExpandedFile(expandedFile === file ? null : file)
  const toggleViewMode = (file: string) => setViewMode(prev => ({ ...prev, [file]: prev[file] === 'changes' ? 'final' : 'changes' }))

  const toggleReviewed = (file: string) => {
    setReviewedFiles(prev => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else {
        next.add(file)
        const remaining = files.find(f => f !== file && !next.has(f))
        setExpandedFile(remaining ?? null)
      }
      return next
    })
  }

  const allReviewed = files.length > 0 && files.every(f => reviewedFiles.has(f))
  const hasComment = comment.trim().length > 0

  const handleSubmitReview = async (reviewAction: 'approve' | 'request-changes') => {
    if (!repoPath) return
    if (!online) { alert("You're offline — keep editing; publishing and review need a connection."); return }
    setAction(reviewAction)
    setStatus('submitting')
    const result = await window.api.git.reviewPR(repoPath, prNum, reviewAction, comment)
    if (result.ok) setStatus('done')
    else { alert(`Couldn't submit review: ${result.error}`); setStatus('idle') }
  }

  const makeEdits = async () => {
    if (!pr) return
    await window.api.git.switchBranch(repoPath, pr.headRefName)
    navigate(`/system/${systemId}`)
  }

  const publish = async () => {
    setPublishing(true)
    const r = await window.api.git.mergePR(repoPath, prNum)
    setPublishing(false)
    if (r.ok) navigate('/inbox')
    else alert(`Couldn't publish: ${r.error}`)
  }

  const fileNameOf = (path: string) => path.split('/').pop() || path
  const filePathOf = (path: string) => { const p = path.split('/'); return p.length > 1 ? p.slice(0, -1).join('/') + '/' : '' }

  const badge: { variant: BadgeVariant; label: string } =
    !isAuthor ? { variant: 'brand', label: 'Needs your review' }
    : pr?.reviewDecision === 'APPROVED' ? { variant: 'success', label: 'Approved' }
    : pr?.reviewDecision === 'CHANGES_REQUESTED' ? { variant: 'warning', label: 'Changes requested' }
    : { variant: 'neutral', label: 'In review' }

  const Icon = system ? (iconMap[system.icon] || BookIcon) : BookIcon
  const chipTint = system ? softTint(primaryColor(system.gradient)) : undefined

  return (
    <div className="review-page">
      <div className="review-inner">
        <Link to="/inbox" className="review-back">← Inbox</Link>

        {status === 'done' ? (
          <div className="review-header">
            <div className="review-success">
              {action === 'approve' ? '✓ Approved — the author can publish when ready.' : '✓ Changes requested — the author will be notified.'}
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Link to="/inbox" style={{ color: 'var(--amp-violet-700)', fontSize: '13px' }}>Back to Inbox</Link>
            </div>
          </div>
        ) : pr ? (
          <>
            <div className="review-header">
              <div className="review-header-chip" style={{ background: chipTint }}><Icon size={20} /></div>
              <div className="review-header-main">
                <div className="review-title">{pr.title}</div>
                <div className="review-meta">
                  {pr.author.name || pr.author.login} · {system?.name} · {files.length} file{files.length !== 1 ? 's' : ''} · {timeAgo(pr.createdAt)}
                </div>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <div className="review-menu-wrap">
                <button className="review-kebab" onClick={() => setMenuOpen(o => !o)} aria-label="More actions">⋯</button>
                {menuOpen && (
                  <>
                    <div className="review-menu-scrim" onClick={() => setMenuOpen(false)} />
                    <div className="review-menu">
                      <button className="review-menu-item" onClick={() => { setMenuOpen(false); window.open(pr.url) }}>View on GitHub</button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {isAuthor && feedback && feedback.state === 'CHANGES_REQUESTED' && feedback.body && (
              <div className="review-feedback">
                <div className="review-feedback-avatar">{feedback.authorName.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="review-feedback-name">{feedback.authorName} asked for changes</div>
                  <div className="review-feedback-text">{feedback.body}</div>
                </div>
              </div>
            )}

            {pr.body && (
              <div className="review-desc">
                <div className="review-desc-label">Description</div>
                <p>{pr.body}</p>
              </div>
            )}

            <div className="review-files-label">{files.length} file{files.length !== 1 ? 's' : ''} changed</div>
            <div className="review-files">
              {files.map(file => {
                const isExpanded = expandedFile === file
                const diff = fileDiffs[file]
                const mode = getViewMode(file)
                return (
                  <div key={file} className={`review-file-card ${isExpanded ? 'expanded' : ''}`}>
                    <div className="review-file-header" onClick={() => toggleFile(file)}>
                      <span className="review-file-chevron"><Chevron open={isExpanded} /></span>
                      <div className="review-file-info">
                        <span className="review-file-name-label">{fileNameOf(file)}</span>
                        <span className="review-file-path">{filePathOf(file)}</span>
                      </div>
                      {isAuthor ? (
                        <span className="review-file-readonly">Read-only</span>
                      ) : (
                        <button className={`review-file-reviewed ${reviewedFiles.has(file) ? 'reviewed' : ''}`} onClick={e => { e.stopPropagation(); toggleReviewed(file) }}>
                          {reviewedFiles.has(file) ? '✓ Reviewed' : 'Mark reviewed'}
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="review-file-content">
                        <div className="review-file-toolbar">
                          <button className={`review-view-toggle ${mode === 'final' ? 'active' : ''}`} onClick={() => { if (mode !== 'final') toggleViewMode(file) }}>Updated version</button>
                          <button className={`review-view-toggle ${mode === 'changes' ? 'active' : ''}`} onClick={() => { if (mode !== 'changes') toggleViewMode(file) }}>What changed</button>
                        </div>
                        {mode === 'final' ? (
                          <div className="review-tiptap-container">
                            {fileContents[file] ? <EditorContent editor={editor} className="review-tiptap-body" /> : <div style={{ padding: '20px', color: 'var(--color-text-tertiary)' }}>Loading…</div>}
                          </div>
                        ) : (
                          <div className="review-diff-doc">
                            {!diff && <div style={{ padding: '20px', color: 'var(--color-text-tertiary)' }}>Loading…</div>}
                            {diff && diff.filter(l => l.type !== 'header').map((line, i) => (
                              <div key={i} className={`review-diff-doc-line ${line.type}`}>{line.content || ' '}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {isAuthor ? (
              <div className="review-actionbar">
                <span className="review-actionbar-note">
                  {pr.reviewDecision === 'CHANGES_REQUESTED' ? 'Make your changes, then it goes back for another look.'
                    : pr.reviewDecision === 'APPROVED' ? 'Approved — ready to publish.'
                    : 'Waiting on your reviewer.'}
                </span>
                <div className="review-actionbar-btns">
                  <button className="review-btn ghost" onClick={makeEdits}>Make edits</button>
                  {pr.reviewDecision === 'APPROVED' && (
                    <button className="review-btn publish" onClick={publish} disabled={publishing || !online}>{publishing ? 'Publishing…' : 'Publish'}</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="review-actionbar">
                <textarea
                  className="review-ta"
                  placeholder="Optional note — or say what should change if you're requesting changes…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <div className="review-actionbar-row">
                  <span className="review-actionbar-hint">{reviewedFiles.size} of {files.length} file{files.length === 1 ? '' : 's'} reviewed</span>
                  <div className="review-actionbar-btns">
                    <button className="review-btn req" onClick={() => handleSubmitReview('request-changes')} disabled={!hasComment || status === 'submitting' || !online}
                      title={!online ? "You're offline — reconnect to submit" : !hasComment ? 'Add a note describing what should change' : ''}>
                      {status === 'submitting' && action === 'request-changes' ? 'Submitting…' : 'Request changes'}
                    </button>
                    <button className="review-btn approve" onClick={() => handleSubmitReview('approve')} disabled={!allReviewed || status === 'submitting' || !online}
                      title={!online ? "You're offline — reconnect to submit" : !allReviewed ? 'Mark all files as reviewed first' : ''}>
                      {status === 'submitting' && action === 'approve' ? 'Approving…' : allReviewed ? 'Approve' : `Approve (${reviewedFiles.size}/${files.length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="review-header"><div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px' }}>Loading…</div></div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `Review.css`**

Replace the entire contents of `app/src/renderer/pages/Review.css`:

```css
.review-page { overflow-y: auto; height: 100%; padding-top: 52px; }
.review-inner { max-width: 820px; margin: 0 auto; padding: 0 48px 80px; }

.review-back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--text-xs); font-weight: var(--font-weight-semibold);
  color: var(--amp-violet-700); text-decoration: none; margin-bottom: 16px;
  padding: 4px 8px; border-radius: 6px;
}
.review-back:hover { background: var(--amp-white); }

/* Header */
.review-header {
  background: var(--amp-white); border: 1px solid var(--color-border-default);
  border-radius: 14px; padding: 16px 18px; margin-bottom: 16px;
  display: flex; align-items: center; gap: 13px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.review-header-chip {
  width: 38px; height: 38px; border-radius: var(--radius-md); flex: none;
  display: flex; align-items: center; justify-content: center; color: var(--color-text-primary);
}
.review-header-main { flex: 1; min-width: 0; }
.review-title { font-size: var(--text-lg); font-weight: 700; color: var(--color-text-primary); letter-spacing: -0.01em; }
.review-meta { font-size: var(--text-xs); color: var(--color-text-tertiary); margin-top: 3px; }

.review-menu-wrap { position: relative; flex: none; }
.review-kebab { background: none; border: none; color: var(--amp-gray-400); font-size: 16px; line-height: 1; padding: 4px 6px; border-radius: 6px; cursor: pointer; }
.review-kebab:hover { background: var(--color-bg-secondary); }
.review-menu-scrim { position: fixed; inset: 0; z-index: 10; }
.review-menu { position: absolute; right: 0; top: 30px; z-index: 11; background: var(--amp-white); border: 1px solid var(--color-border-default); border-radius: 10px; box-shadow: var(--shadow-md); padding: 5px; width: 168px; }
.review-menu-item { display: block; width: 100%; text-align: left; padding: 8px 10px; font-size: var(--text-xs); color: var(--color-text-primary); background: none; border: none; border-radius: 7px; cursor: pointer; font-family: inherit; }
.review-menu-item:hover { background: var(--color-bg-tertiary); }

/* Reviewer feedback callout (author + changes requested) */
.review-feedback {
  background: #FFF8EE; border: 1px solid var(--amp-orange-300);
  border-radius: 12px; padding: 13px 15px; display: flex; gap: 11px; margin-bottom: 14px;
}
.review-feedback-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--amp-orange-500); color: var(--amp-white); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex: none; }
.review-feedback-name { font-size: var(--text-xs); font-weight: 700; color: #8A5A1E; }
.review-feedback-text { font-size: var(--text-sm); color: #7A5A2E; line-height: 1.5; margin-top: 2px; white-space: pre-wrap; }

/* Optional description */
.review-desc { background: var(--amp-white); border: 1px solid var(--color-border-default); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.review-desc-label { font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--amp-gray-400); margin-bottom: 6px; }
.review-desc p { font-size: var(--text-sm); color: var(--color-text-secondary); line-height: 1.55; margin: 0; white-space: pre-wrap; }

.review-files-label { font-size: var(--text-xs); font-weight: var(--font-weight-semibold); letter-spacing: 0.06em; text-transform: uppercase; color: var(--amp-gray-400); margin-bottom: 10px; }
.review-files { display: flex; flex-direction: column; gap: 8px; }

.review-file-card { background: var(--amp-white); border: 1px solid var(--color-border-default); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.review-file-header { display: flex; align-items: center; gap: 10px; padding: 12px 15px; cursor: pointer; }
.review-file-header:hover { background: var(--color-bg-tertiary); }
.review-file-chevron { display: inline-flex; align-items: center; justify-content: center; color: var(--amp-gray-400); width: 22px; height: 22px; flex-shrink: 0; }
.review-file-info { display: flex; gap: 8px; align-items: baseline; min-width: 0; flex: 1; }
.review-file-name-label { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.review-file-path { font-size: var(--text-xs); color: var(--amp-gray-400); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-file-readonly { font-size: var(--text-xs); color: var(--amp-gray-400); flex-shrink: 0; }
.review-file-reviewed { padding: 5px 12px; font-size: var(--text-xs); font-weight: var(--font-weight-medium); border-radius: 999px; border: 1px solid var(--color-border-default); background: var(--amp-white); color: var(--color-text-secondary); cursor: pointer; font-family: inherit; flex-shrink: 0; }
.review-file-reviewed:hover { background: var(--color-bg-tertiary); }
.review-file-reviewed.reviewed { background: var(--amp-violet-700); color: var(--amp-white); border-color: var(--amp-violet-700); }

.review-file-content { border-top: 1px solid var(--color-border-subtle); }
.review-file-toolbar { display: inline-flex; gap: 3px; padding: 10px 15px 0; }
.review-view-toggle { padding: 5px 12px; font-size: var(--text-xs); font-weight: var(--font-weight-semibold); border-radius: 6px; border: none; background: var(--color-bg-tertiary); color: var(--color-text-secondary); cursor: pointer; font-family: inherit; }
.review-view-toggle.active { background: var(--amp-violet-700); color: var(--amp-white); }

.review-tiptap-container { padding: 12px 20px 18px; max-height: 500px; overflow-y: auto; }
.review-tiptap-body .tiptap { outline: none; font-size: 15px; line-height: 1.75; color: var(--color-text-secondary); }
.review-tiptap-body .tiptap h1 { font-size: 24px; font-weight: 700; color: var(--color-text-primary); margin: 28px 0 10px; }
.review-tiptap-body .tiptap h2 { font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin: 24px 0 8px; }
.review-tiptap-body .tiptap h3 { font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin: 20px 0 6px; }
.review-tiptap-body .tiptap p { margin-bottom: 10px; }
.review-tiptap-body .tiptap strong { color: var(--color-text-primary); font-weight: 600; }
.review-tiptap-body .tiptap ul, .review-tiptap-body .tiptap ol { padding-left: 24px; margin-bottom: 10px; }
.review-tiptap-body .tiptap li { margin-bottom: 4px; }
.review-tiptap-body .tiptap blockquote { border-left: 3px solid var(--amp-violet-700); padding: 10px 16px; margin: 12px 0; background: var(--amp-violet-50); border-radius: 0 8px 8px 0; }
.review-tiptap-body .tiptap code { background: var(--color-bg-tertiary); padding: 2px 5px; border-radius: 4px; font-size: 0.9em; }
.review-tiptap-body .tiptap pre { background: var(--amp-gray-900); color: #e0ddd8; padding: 16px; border-radius: 10px; margin: 12px 0; font-size: 12px; overflow-x: auto; }
.review-tiptap-body .tiptap pre code { background: none; color: inherit; padding: 0; }
.review-tiptap-body .tiptap > *:first-child { margin-top: 0; }

.review-diff-doc { padding: 14px 20px 18px; font-size: 14px; line-height: 1.75; color: var(--color-text-secondary); max-height: 500px; overflow-y: auto; }
.review-diff-doc-line { padding: 2px 8px; border-radius: 4px; margin-bottom: 1px; }
.review-diff-doc-line.added { background: rgba(22,163,74,0.08); border-left: 3px solid rgba(22,163,74,0.4); padding-left: 12px; color: var(--color-text-primary); }
.review-diff-doc-line.removed { background: rgba(220,38,38,0.06); border-left: 3px solid rgba(220,38,38,0.3); padding-left: 12px; text-decoration: line-through; color: var(--amp-gray-400); }
.review-diff-doc-line.context { color: var(--color-text-secondary); }

/* Sticky action bar */
.review-actionbar {
  position: sticky; bottom: 16px; margin-top: 18px;
  background: var(--amp-white); border: 1px solid var(--color-border-default);
  border-radius: 14px; padding: 14px 16px; box-shadow: 0 -2px 16px rgba(40,20,50,0.06);
  display: flex; align-items: center; gap: 12px;
}
.review-actionbar-note { font-size: var(--text-xs); color: var(--color-text-tertiary); }
.review-actionbar-btns { margin-left: auto; display: flex; gap: 9px; }
.review-actionbar-row { display: flex; align-items: center; gap: 12px; margin-top: 11px; width: 100%; }
.review-actionbar-hint { font-size: var(--text-xs); color: var(--color-text-tertiary); }
/* reviewer bar stacks the textarea above the row */
.review-actionbar:has(.review-ta) { flex-direction: column; align-items: stretch; }

.review-ta { width: 100%; border: 1px solid var(--color-border-default); border-radius: 9px; padding: 10px 12px; font-size: var(--text-sm); font-family: inherit; color: var(--color-text-primary); resize: vertical; min-height: 64px; box-sizing: border-box; background: var(--color-bg-tertiary); }
.review-ta:focus { outline: none; border-color: var(--color-border-focus); box-shadow: 0 0 0 3px rgba(139,43,255,0.1); background: var(--amp-white); }
.review-ta::placeholder { color: var(--amp-gray-400); }

.review-btn { border: none; border-radius: 8px; padding: 9px 16px; font-size: var(--text-sm); font-weight: var(--font-weight-semibold); font-family: inherit; cursor: pointer; }
.review-btn:disabled { opacity: 0.5; cursor: default; }
.review-btn.ghost { background: var(--amp-white); color: var(--color-text-secondary); border: 1px solid var(--color-border-default); }
.review-btn.publish { background: var(--color-status-success); color: var(--amp-white); }
.review-btn.approve { background: var(--color-status-success); color: var(--amp-white); }
.review-btn.req { background: var(--amp-white); color: var(--color-status-warning); border: 1px solid var(--amp-orange-300); }

.review-success { text-align: center; padding: 20px; font-size: 15px; font-weight: var(--font-weight-medium); color: var(--color-status-success); }

@media (prefers-reduced-motion: reduce) { .review-file-chevron svg { transition: none !important; } }
```

- [ ] **Step 3: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'Review\.tsx' || echo "(clean)"`
Expected: `(clean)`.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/pages/Review.tsx app/src/renderer/pages/Review.css
git commit -m "feat(review): role-aware review page (reviewer + author read-only modes)"
```

---

## Task 3: Visual-critique + apple-design polish pass

**Files:** any Review files above, as findings require (never WIP files).

- [ ] **Step 1: Launch + capture**

Launch the app (restart if `main` changed for Task 1). From the Inbox, open the review (reviewer mode: the Sales System review requesting your review). If possible, also view one of your own PRs (author mode). Screenshot each.

- [ ] **Step 2: Critique**

Invoke `visual-critique:critique-screen` on the review page(s). Produce a prioritized fix list across the seven lenses (hierarchy, composition, color, typography, density, affordance, brand consistency).

- [ ] **Step 3: Apple-design checklist**

Against `.agents/skills/apple-design/SKILL.md`: sticky action bar always reachable; compositor-only transitions; `prefers-reduced-motion`/`prefers-contrast`; heading tracking; the primary action (Approve / Publish / Make edits) is the clear focal point; plain-language copy; read-only affordance obvious in author mode.

- [ ] **Step 4: Apply high/medium fixes**

Implement high/medium findings. Re-screenshot to confirm.

- [ ] **Step 5: Full verification**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'Review|github\.ts|env\.d\.ts' || echo "(clean)"; npx vitest run`
Expected: `(clean)`; all tests PASS. Confirm reviewer flow (mark reviewed → approve / request changes) and author flow (read-only + Make edits, and Publish when approved) both work.

- [ ] **Step 6: Commit**

```bash
git add app/src/renderer/pages/Review.tsx app/src/renderer/pages/Review.css
git commit -m "polish(review): apply visual-critique + apple-design findings"
```

---

## Self-Review (completed)

**Spec coverage:** role-aware one page (T2 `isAuthor`) ✓; header with system chip + status badge + ⋯ View on GitHub (T2) ✓; optional Description hidden-when-empty (T2, uses `pr.body` from Part 1) ✓; "Updated version / What changed" labels (T2) ✓; reviewer Mark reviewed + explicit Approve (optional note) / Request changes (note required) via sticky bar (T2) ✓; author read-only (no mark-reviewed/approve), feedback callout (T1 `latestReview` + T2), Make edits / Publish (T2) ✓; plain language, design-system reuse (T2 CSS) ✓; motion/accessibility (T2 CSS + T3) ✓.

**Placeholder scan:** none — full code for both files; T1 has a concrete `resolveUserName` fallback note.

**Type consistency:** `PRInfo` fields consumed match `listPRs` return (Part 1: `url`/`body`/`headRefName` present); `Feedback` shape matches `latestReview` return (T1↔T2); `BadgeVariant` values ('brand'/'success'/'warning'/'neutral') match `Badge`; `mergePR`/`switchBranch`/`reviewPR` signatures match existing bridges.

## Open questions

- The `.review-actionbar:has(.review-ta)` selector switches the reviewer bar to a column layout; if the target Electron/Chromium predates `:has()` support, replace with an explicit `.review-actionbar.reviewer` class toggled in `Review.tsx`. Verify during Task 3.
