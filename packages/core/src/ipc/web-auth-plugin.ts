import { z } from 'zod'
import type { StartWebAuth } from '../classic/classic-access.ts'
import { currentIpc } from './bridge.ts'
import type { IpcBridgeService } from './ipc-service.ts'
import { definePluginCommand } from './plugin.ts'

/**
 * Typed bindings for `plugins/tauri-plugin-web-auth`, the system web sign-in
 * session.
 */

export interface WebAuthOptions {
  /** The page to open, usually an OAuth authorize URL. */
  url: string
  /** The URL scheme (without `://`) whose navigation ends the session, e.g. `reflect`. */
  callbackScheme: string
  /** When true, the session shares no cookies or website data with the system browser. */
  ephemeral: boolean
}

// iOS omits `url` on cancel and the desktop stub sends `null`; accept both.
const startCommand = definePluginCommand<
  { payload: WebAuthOptions },
  { url?: string | null | undefined }
>('web-auth', 'start', z.object({ url: z.string().nullish() }))

/** The system web sign-in session. */
export interface WebAuthService {
  /**
   * Open `url` in the system web sign-in session and resolve the callback URL
   * it redirects to, or `null` when the user cancels.
   */
  start: StartWebAuth
}

export function createWebAuthService(deps: { ipc: IpcBridgeService }): WebAuthService {
  const { ipc } = deps
  return {
    async start(options) {
      const payload: WebAuthOptions = {
        url: options.url,
        callbackScheme: options.callbackScheme,
        ephemeral: options.ephemeral,
      }
      return (await startCommand(ipc, { payload })).url ?? null
    },
  }
}

let defaultService: WebAuthService | null = null

/** The process-wide `WebAuthService`; one over the installed bridge unless replaced. */
export function defaultWebAuth(): WebAuthService {
  defaultService ??= createWebAuthService({ ipc: currentIpc() })
  return defaultService
}

/** Install the process-wide `WebAuthService`; `null` restores the bridge-backed one. */
export function setDefaultWebAuth(service: WebAuthService | null): void {
  defaultService = service
}

/** {@link WebAuthService.start} on the process-wide service. */
export const startWebAuth: StartWebAuth = async (options) => await defaultWebAuth().start(options)
