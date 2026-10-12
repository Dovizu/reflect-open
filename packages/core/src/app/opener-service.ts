import { errorMessage } from '../errors.ts'
import type { LoggerService } from './logger-service.ts'

/** A macOS System Settings privacy pane. */
export type SystemSettingsPane = 'calendar' | 'contacts'

/** Hands URLs and paths to the operating system. */
export interface OpenerService {
  /** Open `url` with its default handler. */
  openUrl(url: string): Promise<void>
  /** {@link openUrl} without a promise; a failure is logged. */
  openUrlSync(url: string): void
  /** Show `path` in the system file manager. */
  revealInFileManager(path: string): Promise<void>
  /** Open a System Settings privacy pane; a failure is logged. */
  openSystemSettings(pane: SystemSettingsPane): void
}

/** The native operations behind an {@link OpenerService}. */
export interface OpenerTransport {
  openUrl(url: string): Promise<void>
  revealItemInDir(path: string): Promise<void>
}

const SYSTEM_SETTINGS_URLS: Record<SystemSettingsPane, string> = {
  calendar: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars',
  contacts: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
}

export function createOpenerService(deps: {
  transport: OpenerTransport
  logger: LoggerService
}): OpenerService {
  const { transport, logger } = deps

  const openUrlSync = (url: string): void => {
    void transport.openUrl(url).catch((cause: unknown) => {
      logger.error(`failed to open ${url}:`, errorMessage(cause))
    })
  }

  return {
    openUrl: (url) => transport.openUrl(url),
    openUrlSync,
    revealInFileManager: (path) => transport.revealItemInDir(path),
    openSystemSettings: (pane) => {
      openUrlSync(SYSTEM_SETTINGS_URLS[pane])
    },
  }
}
