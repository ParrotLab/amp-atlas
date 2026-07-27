import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import type { DecorationSet } from '@tiptap/pm/view'
import { roundTrip, editorExtensions } from '../markdownSerializer'

// These are markdown-level tests — parse, serialize, and the editing commands around a diagram.
// The drawn SVG is not asserted anywhere: jsdom has no SVG layout, and mermaid is stubbed for
// the whole suite in vitest.setup.ts. Rendering is verified by hand in the running app.

const DIAGRAM = ['```mermaid', 'graph TD', '  A[Start] --> B[Next]', '```'].join('\n')

const nodeNames = (markdown: string): string[] => {
  const editor = new Editor({ extensions: editorExtensions(), content: markdown, contentType: 'markdown' })
  const names = editor.state.doc.content.content.map(n => n.type.name)
  editor.destroy()
  return names
}

describe('mermaid block markdown round-trip', () => {
  it('preserves a mermaid fence byte-for-byte', () => {
    expect(roundTrip(DIAGRAM).trim()).toBe(DIAGRAM)
  })

  it('parses a mermaid fence to a mermaidBlock node, not a codeBlock', () => {
    expect(nodeNames(DIAGRAM)).toEqual(['mermaidBlock'])
  })

  it('survives surrounding content intact', () => {
    const md = ['# Title', '', 'Some prose.', '', DIAGRAM, '', '- a bullet'].join('\n')
    const out = roundTrip(md).trim()
    expect(out).toContain(DIAGRAM)
    expect(out).toContain('# Title')
    expect(out).toContain('- a bullet')
  })

  it('round-trips an empty mermaid block', () => {
    const out = roundTrip('```mermaid\n\n```').trim()
    expect(out).toBe('```mermaid\n\n```')
  })

  // The regression this guards: applyMarkdownEscapeFix backslash-escapes ` and \ in ordinary
  // text. If the node ever loses `code: true`, every save silently corrupts diagram source.
  it('does not escape backticks or backslashes in the source', () => {
    const md = ['```mermaid', 'graph TD', '  A["a \\ b"] --> B["`tick`"]', '```'].join('\n')
    const out = roundTrip(md).trim()
    expect(out).toBe(md)
    expect(out).not.toContain('\\\\')
    expect(out).not.toContain('\\`')
  })

  it('keeps indentation, which mermaid is whitespace-sensitive about', () => {
    const md = ['```mermaid', 'sequenceDiagram', '    Alice->>John: Hello', '    John-->>Alice: Hi', '```'].join('\n')
    expect(roundTrip(md).trim()).toBe(md)
  })
})

describe('mermaid block does not capture other code fences', () => {
  it('leaves a js fence as a normal codeBlock', () => {
    expect(nodeNames('```js\nconst x = 1\n```')).toEqual(['codeBlock'])
    expect(roundTrip('```js\nconst x = 1\n```').trim()).toBe('```js\nconst x = 1\n```')
  })

  it('leaves a fence with no language as a normal codeBlock', () => {
    expect(nodeNames('```\nplain\n```')).toEqual(['codeBlock'])
  })

  it('leaves a fence whose language merely starts with "mermaid" alone', () => {
    expect(nodeNames('```mermaidjs\nnot a diagram\n```')).toEqual(['codeBlock'])
  })

  // Declined on purpose. marked puts the whole info string in `token.lang`, and renderMarkdown
  // always writes a bare "```mermaid" — so claiming this would silently drop "theme=dark" on the
  // next save. Leaving it a codeBlock round-trips it losslessly instead.
  it('declines a fence with trailing metadata rather than dropping it on save', () => {
    const md = '```mermaid theme=dark\ngraph TD\n```'
    expect(nodeNames(md)).toEqual(['codeBlock'])
    expect(roundTrip(md).trim()).toBe(md)
  })
})

// Guards the bug that shipped briefly with a React node view: Tiptap's ReactRenderer calls
// flushSync in its constructor, React skipped the flush because it was already rendering, the
// component never mounted, and ProseMirror — finding no contentDOM — dumped the diagram source
// into the bare wrapper div as unstyled prose with the newlines collapsed.
describe('node view DOM', () => {
  const mountInDom = (markdown: string) => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    return new Editor({ element, extensions: editorExtensions(), content: markdown, contentType: 'markdown' })
  }

  it('builds a pre > code contentDOM synchronously, preserving newlines', () => {
    const editor = mountInDom(DIAGRAM)
    const dom = editor.view.dom as HTMLElement
    const code = dom.querySelector('.mermaid-block pre.mermaid-source > code')
    expect(code).not.toBeNull()
    // The newline is the whole point — a div would collapse it and mermaid would never parse.
    expect(code?.textContent).toBe('graph TD\n  A[Start] --> B[Next]')
    expect(dom.querySelector('.mermaid-block .mermaid-preview')).not.toBeNull()
    editor.destroy()
  })

  it('switches data-mode to rendered when the caret leaves the block', () => {
    const editor = mountInDom(`${DIAGRAM}\n\nafter`)
    const block = () => editor.view.dom.querySelector('.mermaid-block') as HTMLElement

    let inside = 0
    editor.state.doc.descendants((n, pos) => { if (n.type.name === 'mermaidBlock') inside = pos + 1 })
    editor.commands.setTextSelection(inside)
    expect(block().dataset.mode).toBe('source')

    let outside = 0
    editor.state.doc.descendants((n, pos) => { if (n.isTextblock && n.textContent === 'after') outside = pos + 1 })
    editor.commands.setTextSelection(outside)
    expect(block().dataset.mode).toBe('rendered')
    editor.destroy()
  })
})

describe('mermaid block is not destroyed by editing around it', () => {
  const mount = (markdown: string) => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    return new Editor({ element, extensions: editorExtensions(), content: markdown, contentType: 'markdown' })
  }

  const caretAtStartOfDiagram = (editor: Editor) => {
    let target = 0
    editor.state.doc.descendants((n, pos) => { if (n.type.name === 'mermaidBlock') target = pos + 1 })
    editor.commands.setTextSelection(target)
  }

  const backspace = (editor: Editor) =>
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true, cancelable: true }),
    )

  // Without `isolating`, JoinInPlaceBackspace merges the diagram into the paragraph above and
  // the whole fence is lost — verified to produce the single line "intrograph TD".
  it('Backspace at the start of a diagram does not swallow it into the paragraph above', () => {
    const editor = mount(`intro\n\n${DIAGRAM}`)
    caretAtStartOfDiagram(editor)
    backspace(editor)
    const out = editor.getMarkdown()
    expect(out).toContain('```mermaid')
    expect(out).toContain('intro')
    expect(out).not.toContain('intrograph')
    editor.destroy()
  })

  it('Backspace in an empty diagram still clears the block', () => {
    const editor = mount('```mermaid\n\n```')
    caretAtStartOfDiagram(editor)
    backspace(editor)
    expect(editor.getMarkdown()).not.toContain('```mermaid')
    editor.destroy()
  })

  // CodeBlock's own input rule (/^```([a-z]+)?[\s\n]$/) matches "```mermaid " too, so this also
  // pins down that priority 200 puts our rule first. insertContent won't do — input rules only
  // run through handleTextInput, so the final space has to be delivered as real text input.
  // A fence indented under a list item nests as bulletList > listItem > mermaidBlock. The active
  // decoration has to survive that: a walk that stops descending at the first non-mermaid node
  // never reaches it, and the diagram could then never be clicked into and edited.
  it('marks a diagram nested inside a list item as active when the caret is in it', () => {
    const editor = mount('- item\n\n  ```mermaid\n  graph TD\n  ```\n')
    caretAtStartOfDiagram(editor)
    // someProp types this as DecorationSource; at runtime the plugin returns a DecorationSet.
    const decorated = editor.view.someProp('decorations', fn => fn(editor.state)) as DecorationSet | undefined
    const active = (decorated?.find() ?? []).filter(d => d.spec?.mermaidActive === true)
    expect(active).toHaveLength(1)
    editor.destroy()
  })

  it('typing ```mermaid creates a diagram block, not a code block', () => {
    const editor = mount('')
    editor.commands.insertContent('```mermaid')
    const { from } = editor.state.selection
    // The 5th arg is ProseMirror's `deflt` fallback transaction, unused by the input-rules plugin.
    editor.view.someProp('handleTextInput', fn => fn(editor.view, from, from, ' ', () => editor.state.tr))
    expect(editor.state.doc.content.content[0].type.name).toBe('mermaidBlock')
    editor.destroy()
  })
})

// Same spurious-write guard as markdownSerializer.test.ts, but for a document containing a
// diagram — a lossy mermaid round-trip would make FileViewer re-set content on every keystroke.
describe('mermaid block and the emitUpdate load path', () => {
  it('does not fire onUpdate when loaded with emitUpdate:false', () => {
    let updates = 0
    const editor = new Editor({ extensions: editorExtensions(), content: '', onUpdate: () => { updates++ } })
    editor.commands.setContent(`# Doc\n\n${DIAGRAM}`, { contentType: 'markdown', emitUpdate: false })
    expect(updates).toBe(0)
    editor.destroy()
  })

  it('re-serializes a loaded diagram to identical markdown (no re-set loop in FileViewer)', () => {
    const md = `# Doc\n\n${DIAGRAM}`
    const editor = new Editor({ extensions: editorExtensions(), content: '', onUpdate: () => {} })
    editor.commands.setContent(md, { contentType: 'markdown', emitUpdate: false })
    expect(editor.getMarkdown().trim()).toBe(md.trim())
    editor.destroy()
  })
})
