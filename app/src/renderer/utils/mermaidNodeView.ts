import type { Node as PMNode } from '@tiptap/pm/model'
import type { Decoration } from '@tiptap/pm/view'
import type { Editor } from '@tiptap/core'

/**
 * The node view for ```mermaid blocks — see mermaidBlock.ts for why the node exists.
 *
 * Behaviour mirrors Obsidian: the caret inside the block reveals the raw source, moving it out
 * re-renders the diagram. No toggle, no modes. On the Review page the editor is read-only, so the
 * source is never shown at all.
 *
 * This is deliberately a plain ProseMirror node view rather than ReactNodeViewRenderer. Tiptap's
 * React renderer calls flushSync in its constructor, and node views here are constructed during a
 * setContent that happens while React is already rendering — so React skips the flush, the
 * component never mounts, and ProseMirror finds no contentDOM and dumps the diagram source into
 * the bare wrapper div as unstyled, newline-collapsed prose. Building the DOM by hand sidesteps
 * that entirely, and costs nothing: this view has three states and no reconciliation to do.
 */

type Mermaid = typeof import('mermaid').default

/**
 * Mermaid is ~2.5MB (it drags in d3, dagre, cytoscape and katex), so it is imported lazily —
 * Rollup then emits it as its own async chunk and app startup is unaffected. The promise is
 * module-level so the import and initialize() happen once for the whole app, not per block.
 */
let mermaidPromise: Promise<Mermaid> | null = null

function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        // Without this mermaid appends its own error <div> to document.body on invalid syntax,
        // which would float over the editor with no way to dismiss it. We render errors inline.
        // With it, mermaid also cleans up its hidden measuring element on the throwing path, so
        // no manual document.body sweeping is needed (and none should be added — the id mermaid
        // measures under is the same one it stamps on the SVG we then inject).
        suppressErrorRendering: true,
        theme: 'base',
        fontFamily: "'PP Neue Montreal', system-ui, sans-serif",
        // mermaid can't resolve CSS var(), so these mirror tokens.css literally.
        themeVariables: {
          primaryColor: '#F8F0FF',        // --amp-violet-50
          primaryBorderColor: '#8B2BFF',  // --amp-violet-700
          primaryTextColor: '#1A1A1A',    // --amp-gray-900
          lineColor: '#8B2BFF',
          secondaryColor: '#FAF0E6',      // --amp-cream-500
          tertiaryColor: '#FEFCF9',       // --amp-cream-100
          fontSize: '14px',
        },
      })
      return mermaid
    })
  }
  return mermaidPromise
}

/**
 * Rendered SVG keyed by source text, so re-opening a file or collapsing and re-expanding a diff
 * redraws instantly instead of re-running layout.
 *
 * Two identical diagrams in one document share a cached SVG and therefore duplicate element ids.
 * Because the sources are identical the arrow markers are identical too, so `url(#…)` resolving
 * to the first copy's marker is visually correct. Not worth rewriting ids to avoid.
 */
const svgCache = new Map<string, string>()
const CACHE_LIMIT = 50

function cacheSvg(source: string, svg: string): void {
  if (svgCache.size >= CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value
    if (oldest !== undefined) svgCache.delete(oldest)
  }
  svgCache.set(source, svg)
}

// Render ids must be unique per call — the SVG mermaid returns carries the id, so reusing one
// would collide with the copy already in the document and break its arrowheads. A module counter
// keeps it deterministic.
let renderSeq = 0

const RENDER_DEBOUNCE_MS = 200

/**
 * Whether these decorations include the "caret is inside this block" marker set by the plugin in
 * mermaidBlock.ts. Read from `spec` rather than the rendered class because `spec` is the public
 * half of the Decoration API.
 */
export function isActive(decorations: readonly { spec?: Record<string, unknown> }[]): boolean {
  return decorations.some(decoration => decoration.spec?.mermaidActive === true)
}

interface MermaidNodeViewProps {
  node: PMNode
  editor: Editor
  getPos: () => number | undefined
  decorations: readonly Decoration[]
}

export class MermaidNodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private node: PMNode
  private editor: Editor
  private getPos: () => number | undefined
  private decorations: readonly Decoration[]

  private sourceEl: HTMLPreElement
  private previewEl: HTMLDivElement

  private timer: number | null = null
  /** Bumped on every new render request; a resolved render whose token is stale is discarded. */
  private token = 0
  private renderedSource: string | null = null

  constructor({ node, editor, getPos, decorations }: MermaidNodeViewProps) {
    this.node = node
    this.editor = editor
    this.getPos = getPos
    this.decorations = decorations

    this.dom = document.createElement('div')
    this.dom.className = 'mermaid-block'

    this.sourceEl = document.createElement('pre')
    this.sourceEl.className = 'mermaid-source'
    this.sourceEl.spellcheck = false
    const code = document.createElement('code')
    this.sourceEl.appendChild(code)
    this.contentDOM = code

    this.previewEl = document.createElement('div')
    this.previewEl.className = 'mermaid-preview'
    // Mandatory: without it ProseMirror treats the SVG as editable and the browser lets the user
    // type into the diagram.
    this.previewEl.contentEditable = 'false'
    this.previewEl.addEventListener('mousedown', this.handlePreviewMouseDown)

    this.dom.appendChild(this.sourceEl)
    this.dom.appendChild(this.previewEl)

    this.syncMode()
    this.scheduleRender()
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type !== this.node.type) return false
    const sourceChanged = node.textContent !== this.node.textContent
    this.node = node
    this.decorations = decorations
    this.syncMode()
    if (sourceChanged) this.scheduleRender()
    return true
  }

  /**
   * Mermaid replaces the whole preview subtree on every render. That DOM lives inside the node
   * view but outside contentDOM, so without this ProseMirror treats each mutation as a user edit
   * and tries to derive a document position from an SVG <path>.
   */
  ignoreMutation(mutation: MutationRecord | { target: globalThis.Node; type: string }): boolean {
    const target = mutation.target
    const el = target.nodeType === 1 ? (target as Element) : target.parentElement
    return !this.contentDOM.contains(el)
  }

  destroy(): void {
    if (this.timer !== null) window.clearTimeout(this.timer)
    this.token += 1   // invalidate any render still in flight
    this.previewEl.removeEventListener('mousedown', this.handlePreviewMouseDown)
  }

  /** Source while the caret is inside and the editor is editable; diagram otherwise. */
  private syncMode(): void {
    const showSource = this.editor.isEditable && isActive(this.decorations)
    this.dom.dataset.mode = showSource ? 'source' : 'rendered'
  }

  private scheduleRender(): void {
    const source = this.node.textContent.trim()
    if (this.timer !== null) window.clearTimeout(this.timer)
    this.token += 1

    if (!source) {
      this.renderedSource = null
      this.showPlaceholder('Empty diagram — click to add one')
      return
    }

    const cached = svgCache.get(source)
    if (cached) {
      this.renderedSource = source
      this.showSvg(cached)
      return
    }

    // Keep the previous diagram on screen while a new one is computed, so editing a rendered
    // block doesn't flash empty on every keystroke.
    if (this.renderedSource === null) this.showPlaceholder('Drawing diagram…')

    const token = this.token
    this.timer = window.setTimeout(() => {
      const id = `amp-mermaid-${++renderSeq}`
      loadMermaid()
        .then(mermaid => mermaid.render(id, source))
        .then(({ svg }) => {
          cacheSvg(source, svg)
          if (token !== this.token) return   // superseded by a newer edit
          this.renderedSource = source
          this.showSvg(svg)
        })
        .catch((err: unknown) => {
          if (token !== this.token) return
          this.renderedSource = null
          this.showError(err instanceof Error ? err.message : String(err))
        })
    }, RENDER_DEBOUNCE_MS)
  }

  private showSvg(svg: string): void {
    // Safe to inject: mermaid is initialized with securityLevel 'strict', which runs its output
    // through DOMPurify and strips scripts and event handlers.
    this.previewEl.innerHTML = `<div class="mermaid-svg">${svg}</div>`
  }

  private showPlaceholder(text: string): void {
    this.previewEl.textContent = ''
    const el = document.createElement('div')
    el.className = 'mermaid-placeholder'
    el.textContent = text
    this.previewEl.appendChild(el)
  }

  /** The source is echoed under the message so a broken diagram is never an invisible block. */
  private showError(message: string): void {
    this.previewEl.textContent = ''
    const wrap = document.createElement('div')
    wrap.className = 'mermaid-error'
    wrap.setAttribute('role', 'alert')

    const title = document.createElement('span')
    title.className = 'mermaid-error-title'
    title.textContent = 'This diagram couldn’t be drawn'

    const msg = document.createElement('span')
    msg.className = 'mermaid-error-msg'
    msg.textContent = message

    const src = document.createElement('pre')
    src.className = 'mermaid-error-src'
    src.textContent = this.node.textContent

    wrap.append(title, msg, src)
    this.previewEl.appendChild(wrap)
  }

  /**
   * Clicking a rendered diagram drops the caret into its source — the only way into a block whose
   * preview is contentEditable={false}. mousedown rather than click so the caret lands before the
   * browser tries to place its own selection in a non-editable subtree.
   */
  private handlePreviewMouseDown = (event: MouseEvent): void => {
    if (!this.editor.isEditable) return
    const pos = this.getPos()
    if (pos == null) return
    event.preventDefault()
    this.editor.chain().focus().setTextSelection(pos + 1).run()
  }
}
