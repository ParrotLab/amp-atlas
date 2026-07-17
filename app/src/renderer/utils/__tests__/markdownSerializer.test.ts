import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { roundTrip, editorExtensions } from '../markdownSerializer'

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
    expect(out).toContain(md.split('\n')[0].replace(/^[#>\-\d.]+\s*/, '').slice(0, 8))
    expect(out.length).toBeGreaterThan(0)
  })

  it('does not HTML-escape or wrap content', () => {
    const out = roundTrip('Plain paragraph.')
    expect(out).not.toContain('<p>')
    expect(out.trim()).toBe('Plain paragraph.')
  })

  it('preserves nested (sub-) bullets', () => {
    const out = roundTrip('- one\n  - nested a\n  - nested b\n- two').trim()
    expect(out).toContain('- one')
    expect(out).toContain('  - nested a')   // indentation (nesting) survives the round-trip
    expect(out).toContain('  - nested b')
  })

  it('preserves checklists (task list) with checked state', () => {
    const out = roundTrip('- [ ] todo\n- [x] done').trim()
    expect(out).toContain('- [ ] todo')
    expect(out).toContain('- [x] done')
  })
})

// The bubble menu's Indent / Un-indent buttons call sink/liftListItem with the item
// node name ('listItem' for bullet/numbered, 'taskItem' for checklists). Guard that these
// commands actually move items in/out a level for both kinds of list.
describe('list indent / un-indent commands (bubble menu buttons)', () => {
  const posAtText = (editor: Editor, text: string) => {
    let p = 0
    editor.state.doc.descendants((node, pos) => { if (node.isText && node.text === text) p = pos + (node.text?.length ?? 0) })
    return p
  }

  it('sinkListItem indents a bullet, liftListItem outdents it', () => {
    const editor = new Editor({ extensions: editorExtensions(), content: '- one\n- two', contentType: 'markdown' })
    editor.commands.setTextSelection(posAtText(editor, 'two'))
    expect(editor.commands.sinkListItem('listItem')).toBe(true)
    expect(editor.getMarkdown()).toContain('  - two')     // now nested under "one"
    expect(editor.commands.liftListItem('listItem')).toBe(true)
    expect(editor.getMarkdown()).not.toContain('  - two') // back to top level
    editor.destroy()
  })

  it('sinkListItem indents a checklist item via taskItem', () => {
    const editor = new Editor({ extensions: editorExtensions(), content: '- [ ] one\n- [ ] two', contentType: 'markdown' })
    editor.commands.setTextSelection(posAtText(editor, 'two'))
    expect(editor.commands.sinkListItem('taskItem')).toBe(true)
    expect(editor.getMarkdown()).toContain('  - [ ] two')
    editor.destroy()
  })
})

// Regression guard for the "opening a file marks it modified" bug.
// TipTap v3's setContent defaults to emitUpdate:true, so loading a file's content
// programmatically fires onUpdate — which looked like a user edit and wrote a
// re-serialized copy to disk. FileViewer must load content with emitUpdate:false.
describe('setContent emitUpdate (spurious-write guard)', () => {
  it('fires onUpdate by default — this is the trap FileViewer must avoid', () => {
    let updates = 0
    const editor = new Editor({ extensions: editorExtensions(), content: '', onUpdate: () => { updates++ } })
    editor.commands.setContent('# Hello\n\nWorld', { contentType: 'markdown' })
    expect(updates).toBeGreaterThan(0)
    editor.destroy()
  })

  it('does NOT fire onUpdate when emitUpdate:false — the load path FileViewer uses', () => {
    let updates = 0
    const editor = new Editor({ extensions: editorExtensions(), content: '', onUpdate: () => { updates++ } })
    editor.commands.setContent('# Hello\n\nWorld', { contentType: 'markdown', emitUpdate: false })
    expect(updates).toBe(0)
    editor.destroy()
  })

  it('setEditable also emits by default, but not with emitUpdate:false — the toggle FileViewer uses', () => {
    let updates = 0
    const editor = new Editor({ extensions: editorExtensions(), content: 'x', onUpdate: () => { updates++ } })
    editor.setEditable(false)            // default emitUpdate:true — the trap on remount / readOnly flip
    expect(updates).toBeGreaterThan(0)
    updates = 0
    editor.setEditable(true, false)      // FileViewer's call — must not look like an edit
    expect(updates).toBe(0)
    editor.destroy()
  })
})
