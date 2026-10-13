import type {
  ExceptionErrorHandler,
  ExceptionRootOptions,
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
  /**
   * Every error the root handlers received, in order.
   */
  reports(): readonly ExceptionReport[]
}

class TestExceptionTelemetryServiceImpl implements TestExceptionTelemetryService {
  readonly #enabled: boolean
  readonly #recorded: ExceptionReport[] = []
  #installs = 0

  constructor(enabled: boolean) {
    this.#enabled = enabled
  }

  install(): void {
    this.#installs += 1
  }

  reactRootOptions(): ExceptionRootOptions {
    return this.#enabled
      ? {
          onCaughtError: this.#handler('caught'),
          onRecoverableError: this.#handler('recoverable'),
          onUncaughtError: this.#handler('uncaught'),
        }
      : {}
  }

  installCalls(): number {
    return this.#installs
  }

  reports(): readonly ExceptionReport[] {
    return [...this.#recorded]
  }

  #handler(source: ExceptionReportSource): ExceptionErrorHandler {
    return (error, errorInfo) => {
      this.#recorded.push({ source, error, componentStack: errorInfo.componentStack })
    }
  }
}

/**
 * An {@link ExceptionTelemetryService} that records what it would report.
 * With `enabled: false`, `reactRootOptions` is empty like disabled telemetry.
 */
export function createTestExceptionTelemetry(options?: {
  enabled?: boolean
}): TestExceptionTelemetryService {
  return new TestExceptionTelemetryServiceImpl(options?.enabled ?? true)
}
