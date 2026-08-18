import { Node, textblockTypeInputRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { MermaidNodeView } from './mermaidNodeView'

/**
 * Render ```mermaid fences as diagrams, the way Obsidian does — because that's where the team
 * writes these docs, and a fence that draws a flowchart there showed up here as a grey box full
 * of `graph TD` text. Worse, it did so on the Review page too, so a reviewer approving a doc
 * couldn't see the diagram they were approving.
 *
 * This is a separate node rather than `CodeBlock.extend({ addNodeView })` on purpose. Extending
 * CodeBlock routes *every* code block through a custom NodeView — including js and bash ones,
 * whose default <pre><code> rendering would then have to be reimplemented. Claiming only
 * `lang === 'mermaid'` leaves ordinary code blocks completely untouched.
 *
 * The hand-off works because @tiptap/markdown keeps a list of handlers per token name and tries
 * each until one returns a non-empty result (MarkdownManager.parseToken). Handlers are registered
 * in Tiptap's priority order, so a higher priority than CodeBlock's default 100 means this node
 * is asked first and can decline (return []) for every language but mermaid — at which point
 * CodeBlock picks the token up exactly as it does today. No fork, no patch.
 *
 * `code: true` is load-bearing, not decorative: applyMarkdownEscapeFix (see editorKeymap.ts)
 * backslash-escapes ` and \ in ordinary text and skips nodes whose spec is `code`. Without it,
 * every save would inject backslashes into diagram source and corrupt the file.
 */
export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,

  /**
   * The one place we deliberately differ from CodeBlock, which does not set this.
   *
   * JoinInPlaceBackspace (editorKeymap.ts, priority 1000) fires joinTextblockBackward for *any*
   * caret at parentOffset 0. Without `isolating`, a single Backspace at the start of a diagram
   * merges it into the paragraph above and the fence is gone — "intro" + "graph TD" become the
   * one line "intrograph TD". `isolating` makes that command return false and fall through.
   * The Backspace shortcut below keeps an empty block deletable.
   *
   * (Plain code blocks have this same flaw today. Fixing that is a separate change.)
   */
  isolating: true,

  // Above StarterKit's CodeBlock (default 100) so we're offered the 'code' token first.
  priority: 200,

  parseHTML() {
    return [{ tag: 'pre[data-mermaid]', preserveWhitespace: 'full' as const }]
  },

  renderHTML() {
    return ['pre', { 'data-mermaid': '' }, ['code', 0]]
  },

  markdownTokenName: 'code',

  parseMarkdown: (token, helpers) => {
    // Exactly "mermaid" and nothing else. marked puts the whole info string in `lang`, so
    // "```mermaid theme=dark" arrives here as "mermaid theme=dark" — and since renderMarkdown
    // always writes a bare "```mermaid", claiming it would silently delete the metadata on the
    // next save. Declining leaves it a plain codeBlock, which round-trips losslessly.
    // Anything else declined here falls through to CodeBlock unchanged.
    if ((token.lang || '').trim() !== 'mermaid') return []
    const text = token.text ?? ''
    return helpers.createNode('mermaidBlock', {}, text ? [helpers.createTextNode(text)] : [])
  },

  renderMarkdown: (node, helpers) => {
    const source = node.content ? helpers.renderChildren(node.content) : ''
    return ['```mermaid', source, '```'].join('\n')
  },

  addInputRules() {
    return [textblockTypeInputRule({ find: /^```mermaid[\s\n]$/, type: this.type })]
  },

  addKeyboardShortcuts() {
    return {
      // `isolating` blocks the default join, so give an empty diagram an explicit way out —
      // otherwise Backspace in a blank block would do nothing at all. Mirrors CodeBlock's own
      // Backspace handling.
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection
        if (!empty || $anchor.parent.type.name !== this.name) return false
        if ($anchor.parentOffset !== 0 || $anchor.parent.textContent.length > 0) return false
        return this.editor.commands.clearNodes()
      },
    }
  },

  addNodeView() {
    return props => new MermaidNodeView({
      node: props.node,
      editor: props.editor as never,
      getPos: props.getPos as () => number | undefined,
      decorations: props.decorations as readonly Decoration[],
    })
  },

  // A fresh Plugin per editor, matching SelectionHighlight. Four editors exist across the app
  // (FileViewer, Review ×2, PublishModal) and none should share plugin identity.
  addProseMirrorPlugins() {
    return [mermaidActivePlugin()]
  },
})

/**
 * Mark the mermaid block the cursor is currently inside.
 *
 * This is the Obsidian live-preview trick ported from CodeMirror 6 to ProseMirror: the document
 * always holds the raw source, and whether a block shows source or a diagram is a pure function
 * of (doc, selection) rather than a mode flag that can drift out of sync.
 *
 * The decoration has a second, less obvious job. A selection change doesn't alter the node, so
 * nothing would otherwise prompt ProseMirror to update the node view — a rendered diagram would
 * stay rendered after the user clicked into it. Emitting a decoration forces that update.
 */
const mermaidActivePlugin = () => new Plugin({
  key: new PluginKey('mermaidActive'),
  props: {
    decorations(state) {
      const { selection } = state
      const decorations: Decoration[] = []
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'mermaidBlock') {
          if (selection.from >= pos && selection.to <= pos + node.nodeSize) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, { class: 'is-active' }, { mermaidActive: true }),
            )
          }
          return false   // no need to walk the diagram's own text
        }
        // Keep descending through containers (list items, blockquotes) so a nested diagram is
        // still found, but stop at paragraphs and headings, which can't hold one.
        return !node.isTextblock
      })
      return decorations.length ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty
    },
  },
})
