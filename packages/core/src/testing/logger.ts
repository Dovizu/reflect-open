import type { LoggerService } from '../app/logger-service.ts'

export interface LogEntry {
  readonly message: string
  readonly cause: unknown
}

export interface TestLoggerService extends LoggerService {
  getErrors(): readonly LogEntry[]
  getWarnings(): readonly LogEntry[]
  getInfos(): readonly LogEntry[]
}

/** A logger that records every entry and prints nothing. */
export function createTestLoggerService(): TestLoggerService {
  const errors: LogEntry[] = []
  const warnings: LogEntry[] = []
  const infos: LogEntry[] = []
  return {
    error: (message, cause) => {
      errors.push({ message, cause })
    },
    warn: (message, cause) => {
      warnings.push({ message, cause })
    },
    info: (message, cause) => {
      infos.push({ message, cause })
    },
    getErrors: () => [...errors],
    getWarnings: () => [...warnings],
    getInfos: () => [...infos],
  }
}
