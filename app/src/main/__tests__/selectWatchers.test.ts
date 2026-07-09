import { describe, it, expect } from 'vitest'
import { selectWatchers } from '../github'

const pr = (number: number, headRefName: string, login: string, title = `PR ${number}`) =>
  ({ number, headRefName, title, author: { login } })

describe('selectWatchers', () => {
  it('returns PRs (not on the current branch) whose files include relPath', () => {
    const prs = [pr(1, 'draft/other', 'hannah'), pr(2, 'draft/mine', 'me')]
    const filesByPr = { 1: ['systems/a/notes.md'], 2: ['systems/a/notes.md'] }
    const out = selectWatchers(prs, filesByPr, 'draft/mine', 'systems/a/notes.md')
    expect(out).toEqual([{ number: 1, login: 'hannah', title: 'PR 1', branch: 'draft/other' }])
  })

  it('excludes the current branch even when it touches the file', () => {
    const prs = [pr(2, 'draft/mine', 'me')]
    const out = selectWatchers(prs, { 2: ['a.md'] }, 'draft/mine', 'a.md')
    expect(out).toEqual([])
  })

  it('returns [] when no PR touches the file', () => {
    const prs = [pr(1, 'draft/other', 'hannah')]
    const out = selectWatchers(prs, { 1: ['b.md'] }, 'draft/mine', 'a.md')
    expect(out).toEqual([])
  })

  it('returns every PR that touches the file', () => {
    const prs = [pr(1, 'draft/a', 'hannah'), pr(3, 'draft/c', 'sam')]
    const filesByPr = { 1: ['a.md'], 3: ['a.md', 'c.md'] }
    const out = selectWatchers(prs, filesByPr, 'draft/mine', 'a.md')
    expect(out.map(w => w.number)).toEqual([1, 3])
  })

  it('handles zero open PRs', () => {
    expect(selectWatchers([], {}, 'draft/mine', 'a.md')).toEqual([])
  })
})
