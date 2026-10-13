import type { LoggerService } from '../app/logger-service.ts'
import type { PlatformFacts } from '../app/platform-service.ts'
import type { WindowService } from '../app/window-service.ts'
import { type CommandService, createCommandService } from '../commands/command-service.ts'
import {
  createNativeMenuService,
  type NativeContextMenuItem,
  type NativeMenuHost,
  type NativeMenuService,
  type NativeSubmenu,
} from '../commands/native-menu-service.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'
import { createTestIpcBridgeService } from './ipc.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestPlatformService } from './platform.ts'
import { createTestWindowService } from './shell.ts'

export type TestNativeMenuHostCall = 'buildAppMenu' | 'setAsAppMenu' | 'assignNsAppRoles' | 'popup'

/** A {@link NativeMenuHost} that records what it is asked to build. */
export interface TestNativeMenuHost extends NativeMenuHost {
  /** Every host call, in order. */
  readonly calls: readonly TestNativeMenuHostCall[]
  /** The submenus of the installed application menu, or `null` when none is installed. */
  appMenu(): readonly NativeSubmenu[] | null
  /** The items of every context menu opened, in order. */
  popups(): readonly (readonly NativeContextMenuItem[])[]
}

export function createTestNativeMenuHost(): TestNativeMenuHost {
  const calls: TestNativeMenuHostCall[] = []
  const popups: (readonly NativeContextMenuItem[])[] = []
  let appMenu: readonly NativeSubmenu[] | null = null
  return {
    calls,
    async buildAppMenu(submenus) {
      calls.push('buildAppMenu')
      return {
        async setAsAppMenu() {
          calls.push('setAsAppMenu')
          appMenu = submenus
        },
        async assignNsAppRoles() {
          calls.push('assignNsAppRoles')
        },
      }
    },
    async popup(items) {
      calls.push('popup')
      popups.push(items)
    },
    appMenu: () => appMenu,
    popups: () => [...popups],
  }
}

export interface TestNativeMenuServiceOptions {
  /** Defaults to an empty registry. */
  commands?: Pick<CommandService, 'list'>
  /** Defaults to a focused main window. */
  window?: Pick<
    WindowService,
    'isMainWindow' | 'focusedWindowLabel' | 'emitTo' | 'subscribeWindowEvent'
  >
  /** Defaults to a macOS desktop native shell. */
  platform?: Pick<PlatformFacts, 'isMacosDesktop' | 'isNativeShell'>
  /** Defaults to a bridge that answers `menu_install_paste_and_match_style`. */
  ipc?: Pick<IpcBridgeService, 'call'>
  logger?: LoggerService
}

export interface TestNativeMenuService extends NativeMenuService {
  /** The host the service builds its menus on. */
  readonly host: TestNativeMenuHost
}

/** The real {@link NativeMenuService} over a {@link TestNativeMenuHost}. */
export function createTestNativeMenuService(
  options?: TestNativeMenuServiceOptions,
): TestNativeMenuService {
  const host = createTestNativeMenuHost()
  const logger = options?.logger ?? createTestLoggerService()
  const service = createNativeMenuService({
    commands:
      options?.commands ?? createCommandService({ platform: createTestPlatformService(), logger }),
    window: options?.window ?? createTestWindowService(),
    platform: options?.platform ?? createTestPlatformService(),
    ipc:
      options?.ipc ??
      createTestIpcBridgeService({
        commands: { menu_install_paste_and_match_style: () => null },
        logger,
      }),
    logger,
    host,
  })
  return { ...service, host }
}
