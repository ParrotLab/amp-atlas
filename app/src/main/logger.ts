import log from 'electron-log/main'

// File transport only; timestamped; rotates at a size cap. Console stays on in dev.
log.transports.file.level = 'info'
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB, then rotates
log.initialize()

/** Log an operation failure with a short context tag, e.g. logError('publish', err). */
export function logError(context: string, err: unknown): void {
  log.error(`[${context}]`, err instanceof Error ? err.stack || err.message : String(err))
}

export function logInfo(context: string, message: string): void {
  log.info(`[${context}] ${message}`)
}

/** Absolute path to the current log file (for reveal / read). */
export function logFilePath(): string {
  return log.transports.file.getFile().path
}
