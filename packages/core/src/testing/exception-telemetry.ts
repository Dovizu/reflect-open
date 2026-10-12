import type {
  ExceptionErrorHandler,
  ExceptionTelemetryService,
} from '../app/exception-telemetry-service.ts'

export type ExceptionReportSource = 'caught' | 'recoverable' | 'uncaught'

export interface ExceptionReport {
  readonly source: ExceptionReportSource
  readonly error: unknown
  readonly componentStack: string | undefined
}

export interface TestExceptionTelemetryService extends ExceptionTelemetryService {
  installCalls(): number
  /** Every error the root handlers received, in order. */
  reports(): readonly ExceptionReport[]
}

/**
 * An {@link ExceptionTelemetryService} that records what it would report.
 * With `enabled: false`, `reactRootOptions` is empty like disabled telemetry.
 */
export function createTestExceptionTelemetry(options?: {
  enabled?: boolean
}): TestExceptionTelemetryService {
  const enabled = options?.enabled ?? true
  const recorded: ExceptionReport[] = []
  let installs = 0

  const handler =
    (source: ExceptionReportSource): ExceptionErrorHandler =>
    (error, errorInfo) => {
      recorded.push({ source, error, componentStack: errorInfo.componentStack })
    }

  return {
    install() {
      installs += 1
    },
    reactRootOptions: () =>
      enabled
        ? {
            onCaughtError: handler('caught'),
            onRecoverableError: handler('recoverable'),
            onUncaughtError: handler('uncaught'),
          }
        : {},
    installCalls: () => installs,
    reports: () => [...recorded],
  }
}
