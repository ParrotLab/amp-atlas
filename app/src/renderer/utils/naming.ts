/** Human-facing file name: hide the `.md` extension (it stays on disk + in paths/breadcrumbs). */
export function displayName(fileName: string): string {
  return fileName.replace(/\.md$/i, '')
}
