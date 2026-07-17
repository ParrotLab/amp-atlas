import { Extension } from '@tiptap/core'
import { joinTextblockBackward } from '@tiptap/pm/commands'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Stop the markdown serializer from over-escaping prose. By default @tiptap/markdown HTML-encodes
 * `< > &` (so `a > b` is written to disk as `a &gt; b`) and backslash-escapes `` ` * _ [ ] ~ ``
 * (so `~200` becomes `\~200`). That makes the saved files ugly and unlike what the user typed.
 *
 * We override the serializer's `encodeTextForMarkdown` to skip HTML encoding and escape only the
 * two characters that genuinely change meaning on re-parse — backslash and backtick. The library's
 * own code-context guard is preserved, so text inside code marks / code blocks stays literal.
 *
 * Exposed as a plain function (not just the extension hook) because the extension's onCreate fires
 * asynchronously, so a synchronous getMarkdown right after editor creation would miss it.
 */
export function applyMarkdownEscapeFix(editor: { storage: any }): void {
  const mgr = editor?.storage?.markdown?.manager
  if (!mgr || typeof mgr.encodeTextForMarkdown !== 'function' || mgr.__escapeFixApplied) return
  mgr.__escapeFixApplied = true
  mgr.encodeTextForMarkdown = function (text: string, node: any, parentNode: any): string {
    const codeTypes = this.codeTypes
    const insideCode =
      (parentNode?.type != null && codeTypes?.has?.(parentNode.type)) ||
      (node?.marks || []).some((m: any) => codeTypes?.has?.(typeof m === 'string' ? m : m.type))
    if (insideCode) return text
    return text.replace(/([\\`])/g, '\\$1')
  }
}

export const MarkdownEscapeFix = Extension.create({
  name: 'markdownEscapeFix',
  onCreate() { applyMarkdownEscapeFix(this.editor) },
})

/**
 * Backspace at the very start of a text block should *join* it with the block before it,
 * not lift it out of its container. ProseMirror's default Backspace (`joinBackward`) unwraps
 * the block instead — so backspacing at the start of a line inside a blockquote pops the line
 * out of the quote, and inside an ordered list it splits the list and restarts numbering at 1.
 *
 * `joinTextblockBackward` merges the two text blocks in place: the quote stays a quote, and a
 * continuation list (`4. 5. 6.`) keeps its numbering. We only take over the exact boundary case
 * (empty selection, caret at offset 0); everything else — mid-word deletes, selections, and the
 * first-item-in-a-list lift — falls through to the default behavior.
 */
export const JoinInPlaceBackspace = Extension.create({
  name: 'joinInPlaceBackspace',
  // Run ahead of the base keymap so we win the Backspace binding at block starts.
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state, view } = editor
        const { selection } = state
        if (!selection.empty) return false
        if (selection.$from.parentOffset !== 0) return false
        return joinTextblockBackward(state, view.dispatch, view)
      },
    }
  },
})

/**
 * Render the text-selection highlight ourselves with a ProseMirror decoration instead of relying
 * on the browser's native `::selection` paint.
 *
 * Why: the BubbleMenu is positioned by floating-ui with a `transform`, which promotes it to its own
 * compositing layer over the text. Chromium then intermittently fails to invalidate the native
 * `::selection` paint when a selection collapses, leaving a "ghost" highlight until an unrelated
 * repaint clears it. Repaint hacks (opacity nudge, forced reflow, blur/refocus) only papered over
 * it. A decoration is a real DOM element that ProseMirror adds when a range is selected and removes
 * when it collapses — removal is an ordinary DOM mutation that always repaints, so no ghost is
 * possible. Paired CSS makes the native ::selection transparent so only our highlight shows.
 */
export const SelectionHighlight = Extension.create({
  name: 'selectionHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('selectionHighlight'),
        props: {
          decorations(state) {
            const { selection } = state
            if (selection.empty) return DecorationSet.empty
            return DecorationSet.create(state.doc, [
              Decoration.inline(selection.from, selection.to, { class: 'pm-selected' }),
            ])
          },
        },
      }),
    ]
  },
})
