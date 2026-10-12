import { emitTo } from '@tauri-apps/api/event'
import { getAllWebviewWindows, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { MAIN_WINDOW_LABEL, type LoggerService, type WindowHost } from '@reflect/core'

function currentLabel(logger: LoggerService): string {
  try {
    return getCurrentWindow().label
  } catch (cause) {
    // A misclassified note window would boot the main-window singletons, so say so loudly.
    logger.warn('window label unavailable; assuming the main window:', cause)
    return MAIN_WINDOW_LABEL
  }
}

async function focusedLabel(): Promise<string | null> {
  const windows = await getAllWebviewWindows()
  const focused = await Promise.all(
    windows.map(async (window) => {
      try {
        return (await window.isFocused()) ? window.label : null
      } catch {
        // A window can close between enumeration and the focus check.
        return null
      }
    }),
  )
  return focused.find((label) => label !== null) ?? null
}

/** The Tauri webview window this script runs in. */
export function createTauriWindowHost(options: {
  multiWindow: boolean
  logger: LoggerService
}): WindowHost {
  return {
    label: currentLabel(options.logger),
    multiWindow: options.multiWindow,
    setTitle: async (title) => {
      await getCurrentWindow().setTitle(title)
    },
    focusedWindowLabel: focusedLabel,
    emitTo: async (label, event, payload) => {
      await emitTo({ kind: 'WebviewWindow', label }, event, payload)
    },
    listen: async (event, handler) =>
      await getCurrentWebviewWindow().listen<unknown>(event, ({ payload }) => {
        handler(payload)
      }),
    onCloseRequested: async (handler) => await getCurrentWindow().onCloseRequested(handler),
    hide: async () => {
      await getCurrentWindow().hide()
    },
  }
}
