declare module 'gray-matter' {
  interface GrayMatterResult {
    data: Record<string, unknown>
    content: string
  }
  function matter(input: string): GrayMatterResult
  export default matter
}
