// Builds a system card's meta line: "40 playbooks · Updated 2h ago".
// Status text (published/unpublished) is intentionally omitted — that lives inside
// the system where it's actionable. Not-connected systems say so plainly.
export function cardMeta(connected: boolean, playbooks: number | null, updatedRel: string): string {
  if (!connected) return 'Not connected'
  const parts: string[] = []
  if (playbooks !== null) parts.push(`${playbooks} playbook${playbooks === 1 ? '' : 's'}`)
  if (updatedRel) parts.push(`Updated ${updatedRel}`)
  return parts.length ? parts.join(' · ') : 'Connected'
}
