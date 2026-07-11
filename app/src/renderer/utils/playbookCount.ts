// Count of playbooks in a system = folders directly inside <folder>/.claude/skills.
export async function getPlaybookCount(folderPath: string): Promise<number | null> {
  if (!folderPath) return null
  try {
    const res = await window.api.fs.readDirectory(`${folderPath}/.claude/skills`)
    if (!res.ok || !res.entries) return null
    return res.entries.filter((e: { isDirectory: boolean }) => e.isDirectory).length
  } catch {
    return null
  }
}
