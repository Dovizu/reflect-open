import { createCalendarService, type CalendarService } from '../calendar/calendar-service.ts'
import { createContactsService, type ContactsService } from '../contacts/contacts-service.ts'
import { createDatabaseService, type DatabaseService } from '../indexing/database-service.ts'
import { createFileChangeService, type FileChangeService } from '../indexing/file-change-service.ts'
import { createIndexStoreService, type IndexStoreService } from '../indexing/index-store-service.ts'
import {
  createIpcBridgeService,
  type IpcBridge,
  type IpcBridgeService,
} from '../ipc/ipc-service.ts'
import {
  createMobileStorageService,
  type MobileStorageService,
} from '../ipc/mobile-storage-service.ts'
import {
  createSecretStoreService,
  type SecretStoreService,
} from '../secrets/secret-store-service.ts'
import { createAgentSkillService, type AgentSkillService } from './agent-skill-service.ts'
import { createAppInfoService, type AppInfoService } from './app-info-service.ts'
import type { ClipboardService } from './clipboard-service.ts'
import { createSystemClock, type ClockService } from './clock-service.ts'
import type { DialogService } from './dialog-service.ts'
import {
  createDisabledExceptionTelemetry,
  type ExceptionTelemetryService,
} from './exception-telemetry-service.ts'
import { createWebCryptoHashService, type HashService } from './hash-service.ts'
import type { HttpService } from './http-service.ts'
import { createSystemIdService, type IdService } from './id-service.ts'
import { isMobilePlatform } from './platform.ts'
import { createUnavailableImageCodec, type ImageCodecService } from './image-codec-service.ts'
import {
  createLifecycleService,
  type AppLifecycleService,
  type LifecycleDomAdapter,
} from './lifecycle-service.ts'
import { createConsoleLogger, type LoggerService } from './logger-service.ts'
import { createOpenerService, type OpenerService, type OpenerTransport } from './opener-service.ts'
import { createPathService, type PathService, type PathTransport } from './path-service.ts'
import {
  createPlatformService,
  type PlatformFacts,
  type PlatformService,
} from './platform-service.ts'
import { createWebStorageService, type StorageService } from './storage-service.ts'
import { createWindowService, type WindowHost, type WindowService } from './window-service.ts'

/** The app-scoped services: one instance each for the lifetime of the webview. */
export interface AppServices {
  readonly ipc: IpcBridgeService
  readonly logger: LoggerService
  readonly clock: ClockService
  readonly id: IdService
  readonly hash: HashService
  readonly platform: PlatformService
  readonly storage: StorageService
  readonly http: HttpService
  readonly dialog: DialogService
  readonly clipboard: ClipboardService
  readonly opener: OpenerService
  readonly path: PathService
  readonly window: WindowService
  readonly lifecycle: AppLifecycleService
  readonly secretStore: SecretStoreService
  readonly appInfo: AppInfoService
  readonly calendar: CalendarService
  readonly contacts: ContactsService
  readonly agentSkill: AgentSkillService
  readonly mobileStorage: MobileStorageService
  readonly imageCodec: ImageCodecService
  readonly exceptionTelemetry: ExceptionTelemetryService
  readonly database: DatabaseService
  readonly fileChanges: FileChangeService
  readonly indexStore: IndexStoreService
}

/** The host primitives that {@link createAppServices} builds the services on. */
export interface AppAdapters {
  readonly ipc: IpcBridge
  readonly platform: PlatformFacts
  readonly http: HttpService
  /** The Web storage areas; `null` keeps an area in memory. */
  readonly storage: { readonly local: Storage | null; readonly session: Storage | null }
  readonly dialog: DialogService
  readonly clipboard: ClipboardService
  readonly opener: OpenerTransport
  readonly path: PathTransport
  readonly window: WindowHost
  readonly lifecycle: LifecycleDomAdapter
  /** Defaults to the console. */
  readonly logger?: LoggerService
  /** Defaults to the system clock. */
  readonly clock?: ClockService
  /** Defaults to the system `IdService`. */
  readonly id?: IdService
  /** Defaults to Web Crypto. */
  readonly hash?: HashService
  /** Defaults to a codec that cannot decode. */
  readonly imageCodec?: ImageCodecService
  /** Defaults to telemetry that reports nothing. */
  readonly exceptionTelemetry?: ExceptionTelemetryService
}

export function createAppServices(adapters: AppAdapters): AppServices {
  const logger = adapters.logger ?? createConsoleLogger()
  const clock = adapters.clock ?? createSystemClock()
  const ipc = createIpcBridgeService(adapters.ipc, { logger })
  const database = createDatabaseService({ ipc })
  return {
    ipc,
    logger,
    clock,
    id: adapters.id ?? createSystemIdService(),
    hash: adapters.hash ?? createWebCryptoHashService(),
    platform: createPlatformService(adapters.platform),
    storage: createWebStorageService({
      logger,
      localStorage: adapters.storage.local,
      sessionStorage: adapters.storage.session,
    }),
    http: adapters.http,
    dialog: adapters.dialog,
    clipboard: adapters.clipboard,
    opener: createOpenerService({ transport: adapters.opener, logger }),
    path: createPathService({ transport: adapters.path }),
    window: createWindowService({ ipc, host: adapters.window, logger }),
    lifecycle: createLifecycleService({ ipc, dom: adapters.lifecycle, clock, logger }),
    secretStore: createSecretStoreService({ ipc }),
    appInfo: createAppInfoService({ ipc }),
    calendar: createCalendarService({ ipc, logger }),
    contacts: createContactsService({ ipc }),
    agentSkill: createAgentSkillService({ ipc }),
    mobileStorage: createMobileStorageService({ ipc }),
    imageCodec: adapters.imageCodec ?? createUnavailableImageCodec(),
    exceptionTelemetry: adapters.exceptionTelemetry ?? createDisabledExceptionTelemetry(),
    database,
    fileChanges: createFileChangeService(
      { ipc, logger },
      { echoOwnWrites: isMobilePlatform(adapters.platform.appPlatform) },
    ),
    indexStore: createIndexStoreService({ ipc, database }),
  }
}
