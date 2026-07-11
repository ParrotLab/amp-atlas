export type StatusTone = 'idle' | 'ok' | 'attention'
export interface SystemStatus { label: string; tone: StatusTone }

/** Friendly, non-technical status for a system card. */
export function describeSystemStatus(connected: boolean, hasUnpublished: boolean): SystemStatus {
  if (!connected) return { label: 'Not connected', tone: 'idle' }
  if (hasUnpublished) return { label: 'Unpublished changes', tone: 'attention' }
  return { label: 'Up to date', tone: 'ok' }
}

/** "Up to date · 12 playbooks" — count omitted when null. */
export function metaLine(status: SystemStatus, playbooks: number | null): string {
  if (playbooks === null) return status.label
  return `${status.label} · ${playbooks} playbook${playbooks === 1 ? '' : 's'}`
}
