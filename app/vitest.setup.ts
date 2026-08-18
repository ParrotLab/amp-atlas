import { vi } from 'vitest'

/**
 * jsdom has no SVG layout, so a real mermaid render throws `getBBox is not a function`.
 *
 * Editor tests care about the document, never the picture: the round-trip suite asserts that a
 * ```mermaid fence survives parse and serialize byte-for-byte, which is pure markdown work. This
 * mock guarantees no test can pull the real 2.5MB library in, whatever a node view does — today
 * nothing reaches the dynamic import, but that's a consequence of the render debounce rather
 * than anything structural, and it shouldn't be what test safety rests on.
 *
 * vi.mock intercepts by module specifier at transform time, so it covers the lazy
 * `await import('mermaid')` in MermaidBlockView exactly as it would a static import.
 */
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id: string) => ({ svg: `<svg id="${id}"></svg>`, diagramType: 'flowchart' })),
    parse: vi.fn(async () => ({ diagramType: 'flowchart', config: {} })),
  },
}))
