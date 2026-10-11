import { errorMessage } from './errors.ts'
import { getBridge, hasBridge } from './ipc/bridge.ts'

/**
 * Structured logging for `@reflect/core` and the apps built on it.
 *
 * Every line goes to the console (the webview inspector in a shell, the
 * terminal under vitest) and, when a bridge is installed, to the native
 * `log_event` command, which feeds Rust's `tracing` pipeline. That is what
 * lands in the on-disk log file next to the Rust shell's own lines, so a
 * backfill summary from TypeScript sorts next to the `embed_apply` writes it
 * caused. Forwarding is fire-and-forget: a failed forward is dropped, never
 * logged (that would recurse), and never surfaces to the caller.
 *
 * Fields are flat scalars by design: they render as one JSON object per line
 * and must stay greppable. Put paths, counts, and durations in them, never
 * note text: the log file lives outside the graph and outside the
 * `private: true` guard.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Scalar context attached to a line. `undefined` values are dropped. */
export type LogFields = Record<string, string | number | boolean | null | undefined>

export interface Logger {
  debug: (message: string, fields?: LogFields) => void
  info: (message: string, fields?: LogFields) => void
  warn: (message: string, fields?: LogFields) => void
  error: (message: string, fields?: LogFields) => void
}

/** `{ error }` for a caught value, so every error line names the cause the same way. */
export function errorField(cause: unknown): LogFields {
  return { error: errorMessage(cause) }
}

function compact(fields: LogFields | undefined): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  if (fields === undefined) {
    return out
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

function emit(level: LogLevel, module: string, message: string, fields?: LogFields): void {
  const payload = compact(fields)
  const hasFields = Object.keys(payload).length > 0
  const line = `[${module}] ${message}`
  if (hasFields) {
    console[level](line, payload)
  } else {
    console[level](line)
  }
  if (!hasBridge()) {
    return
  }
  let forwarded: Promise<unknown>
  try {
    forwarded = getBridge().invoke('log_event', {
      level,
      module,
      message,
      fields: hasFields ? payload : null,
    })
  } catch {
    return
  }
  void forwarded.catch(() => {})
}

/**
 * A logger for one module. `module` is the `module` field on every line
 * (`embeddings`, `indexing`, `sync`): short, stable, and the thing to grep.
 */
export function createLogger(module: string): Logger {
  return {
    debug: (message, fields) => emit('debug', module, message, fields),
    info: (message, fields) => emit('info', module, message, fields),
    warn: (message, fields) => emit('warn', module, message, fields),
    error: (message, fields) => emit('error', module, message, fields),
  }
}
