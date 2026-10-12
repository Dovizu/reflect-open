/** What a UI root knows about a render failure. */
export interface ExceptionErrorInfo {
  readonly componentStack?: string | undefined
}

export type ExceptionErrorHandler = (error: unknown, errorInfo: ExceptionErrorInfo) => void

/** Error handlers for a React root, shaped like React's `RootOptions`. */
export interface ExceptionRootOptions {
  onCaughtError?: ExceptionErrorHandler
  onRecoverableError?: ExceptionErrorHandler
  onUncaughtError?: ExceptionErrorHandler
}

/** Exception-only crash reporting. */
export interface ExceptionTelemetryService {
  /** Start reporting uncaught errors. Repeat calls and disabled telemetry are no-ops. */
  install(): void
  /** Root handlers that report render failures; empty when telemetry is disabled. */
  reactRootOptions(): ExceptionRootOptions
}

/** An {@link ExceptionTelemetryService} that reports nothing. */
export function createDisabledExceptionTelemetry(): ExceptionTelemetryService {
  return {
    install: () => {},
    reactRootOptions: () => ({}),
  }
}

let defaultService: ExceptionTelemetryService | null = null

/** The process-wide `ExceptionTelemetryService`; a disabled one unless replaced. */
export function defaultExceptionTelemetry(): ExceptionTelemetryService {
  defaultService ??= createDisabledExceptionTelemetry()
  return defaultService
}

/** Install the process-wide `ExceptionTelemetryService`; `null` restores the disabled one. */
export function setDefaultExceptionTelemetry(service: ExceptionTelemetryService | null): void {
  defaultService = service
}
