declare module 'markdown-it' {
  interface MarkdownIt {
    render(src: string): string
  }
  interface MarkdownItConstructor {
    new (options?: Record<string, unknown>): MarkdownIt
  }
  const MarkdownIt: MarkdownItConstructor
  export default MarkdownIt
}
