/** Diagnostic logging. `cause` carries the error or payload behind the message. */
export interface LoggerService {
  error(message: string, cause?: unknown): void
  warn(message: string, cause?: unknown): void
  info(message: string, cause?: unknown): void
}

/** A logger that writes to the global `console`. */
export function createConsoleLogger(): LoggerService {
  // Rest parameters keep a one-argument call one argument long on the console.
  return {
    error: (...args: [message: string, cause?: unknown]) => console.error(...args),
    warn: (...args: [message: string, cause?: unknown]) => console.warn(...args),
    info: (...args: [message: string, cause?: unknown]) => console.info(...args),
  }
}

let fallbackLogger: LoggerService | null = null

/** The logger for code that does not receive one yet; a console logger unless replaced. */
export function defaultLogger(): LoggerService {
  fallbackLogger ??= createConsoleLogger()
  return fallbackLogger
}

/** Replace the {@link defaultLogger}. `null` restores the console logger. */
export function setDefaultLogger(logger: LoggerService | null): void {
  fallbackLogger = logger
}
