/** Record a user-activity breadcrumb to the diagnostics log (best-effort, never throws). */
export function logCrumb(message: string): void {
  try { window.api.diagnostics.log(message) } catch { /* ignore */ }
}
