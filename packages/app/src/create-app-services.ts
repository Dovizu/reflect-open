import type { CoreServices } from '@reflect/core'
import { createCommandService, type CommandService } from './commands/command-service.ts'
import { createKeymapService, type KeymapService } from './commands/keymap-service.ts'
import {
  createNativeMenuService,
  createUnsupportedNativeMenuHost,
  type NativeMenuHost,
  type NativeMenuService,
} from './commands/native-menu-service.ts'
import {
  createPaletteSearchService,
  type PaletteSearchService,
} from './search/palette-search-service.ts'

/**
 * What the host supplies to the app layer: the window, lifecycle, storage,
 * updater, menu and deep-link primitives of one webview.
 */
export interface AppHost {
  /**
   * The native menus; without a host, every menu operation rejects.
   */
  readonly nativeMenu?: NativeMenuHost
}

/**
 * The app-layer services of one webview, built over the core services.
 */
export interface AppServices {
  /**
   * The central keymap registry that rejects duplicate shortcut bindings.
   */
  readonly keymap: KeymapService
  /**
   * The command registry. The app decides the context type that its commands run with.
   */
  readonly commands: CommandService
  /**
   * The native macOS application menu and native context menus.
   */
  readonly nativeMenu: NativeMenuService
  /**
   * The command palette's data layer.
   */
  readonly paletteSearch: PaletteSearchService
}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  const commands = createCommandService({ platform: core.platform, logger: core.logger })
  const keymap = createKeymapService({ platform: core.platform })
  const nativeMenu = createNativeMenuService({
    commands,
    window: core.window,
    platform: core.platform,
    ipc: core.ipc,
    logger: core.logger,
    host: host.nativeMenu ?? createUnsupportedNativeMenuHost(),
  })
  const paletteSearch = createPaletteSearchService({
    suggestions: core.suggestions,
    search: core.search,
    retrieval: core.retrieval,
    commands,
    clock: core.clock,
  })
  return { commands, keymap, nativeMenu, paletteSearch }
}
