import { describe, it, expect, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorExtensions } from '../markdownSerializer'

// Dispatch a real Backspace keydown so the configured keymap (not a hand-picked command) runs.
function backspace(editor: Editor) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true, cancelable: true }),
  )
}

function mount(markdown: string): Editor {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return new Editor({ element: el, extensions: editorExtensions(), content: markdown, contentType: 'markdown' })
}

// Put the caret just before the first character of the text node whose text === needle.
function caretAtStartOf(editor: Editor, needle: string) {
  let pos = -1
  editor.state.doc.descendants((n, p) => { if (pos < 0 && n.isText && n.text === needle) pos = p })
  editor.commands.setTextSelection(pos)
}

describe('Backspace joins in place instead of lifting out (bug #3 / #4a)', () => {
  let editor: Editor
  beforeEach(() => { document.body.innerHTML = '' })

  it('keeps a paragraph inside its blockquote', () => {
    editor = mount('> one\n>\n> two')
    caretAtStartOf(editor, 'two')
    backspace(editor)
    // "two" merges into "one" *within* the quote — it is not popped out into a bare paragraph.
    const md = editor.getMarkdown().trim()
    expect(md).toBe('> onetwo')
    editor.destroy()
  })

  it('keeps an ordered list continuous (no renumber to 1)', () => {
    editor = mount('1. one\n2. two\n3. three')
    caretAtStartOf(editor, 'two')
    backspace(editor)
    const md = editor.getMarkdown().trim()
    // item 2 joins item 1; "three" stays part of the same list as item 2 — not a new "1." list.
    expect(md).toBe('1. onetwo\n2. three')
    editor.destroy()
  })

  it('preserves the start number of a continuation list', () => {
    editor = mount('4. four\n5. five\n6. six')
    caretAtStartOf(editor, 'five')
    backspace(editor)
    const md = editor.getMarkdown().trim()
    expect(md).toBe('4. fourfive\n5. six')
    editor.destroy()
  })

  it('still lifts the first list item out of the list', () => {
    editor = mount('1. one\n2. two')
    caretAtStartOf(editor, 'one')
    backspace(editor)
    // Nothing joinable before the first item, so default behavior applies: it does not stay "1. one".
    const md = editor.getMarkdown().trim()
    expect(md).not.toContain('1. one\n2. two')
    editor.destroy()
  })

  it('does not interfere with deleting a selection', () => {
    // A non-empty selection must fall through to the default delete (our handler bows out).
    editor = mount('hello world')
    let from = -1
    editor.state.doc.descendants((n, p) => { if (n.isText && n.text === 'hello world') from = p })
    editor.commands.setTextSelection({ from, to: from + 6 }) // select "hello "
    backspace(editor)
    expect(editor.getMarkdown().trim()).toBe('world')
    editor.destroy()
  })
})
