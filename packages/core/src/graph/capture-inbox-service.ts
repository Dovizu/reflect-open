import { z } from 'zod'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'
import { fileMetaSchema, type FileMeta } from './schemas.ts'

/** Commands that return `()` from Rust serialize as `null` over IPC. */
const voidSchema = z.null()

/**
 * The capture inbox (`.reflect/inbox/`): envelopes spooled by the browser
 * extension, the iOS share extension, and deep links. Every call except
 * {@link CaptureInboxService.registerHost} is pinned to a graph `generation`.
 */
export interface CaptureInboxService {
  /**
   * Point the capture host at the active graph (pointer file and inbox dir)
   * and rewrite the native-messaging manifests for detected browsers.
   */
  registerHost(): Promise<void>
  /** The spooled `.json` envelopes and their screenshot siblings. A missing inbox lists as empty. */
  list(generation: number): Promise<FileMeta[]>
  /** One spooled envelope's JSON text, by spool filename (for example `<id>.json`). */
  read(name: string, generation: number): Promise<string>
  /** Spool an envelope this app produced, atomically. The caller validates its shape. */
  spool(name: string, json: string, generation: number): Promise<void>
  /** Remove a spool file by filename. Idempotent. */
  remove(name: string, generation: number): Promise<void>
  /** Move an unparseable spool file into `.reflect/inbox-rejected/`. It is never deleted. */
  reject(name: string, generation: number): Promise<void>
  /**
   * Move envelopes the iOS share extension spooled into the App Group inbox
   * into the graph's inbox, resolving with how many moved. Zero where there
   * is no shared container.
   */
  relaySharedInbox(generation: number): Promise<number>
  /**
   * Copy a spooled screenshot into the graph as a downscaled JPEG asset. The
   * spool file stays until it is removed.
   */
  promoteScreenshot(
    spoolName: string,
    assetPath: string,
    maxDim: number,
    generation: number,
  ): Promise<void>
}

export function createCaptureInboxService(deps: { ipc: IpcBridgeService }): CaptureInboxService {
  const { ipc } = deps
  return {
    async registerHost() {
      await ipc.call('capture_host_register', {}, voidSchema)
    },
    async list(generation) {
      return await ipc.call('capture_inbox_list', { generation }, z.array(fileMetaSchema))
    },
    async read(name, generation) {
      return await ipc.call('capture_inbox_read', { name, generation }, z.string())
    },
    async spool(name, json, generation) {
      await ipc.call('capture_inbox_spool', { name, json, generation }, voidSchema)
    },
    async remove(name, generation) {
      await ipc.call('capture_inbox_remove', { name, generation }, voidSchema)
    },
    async reject(name, generation) {
      await ipc.call('capture_inbox_reject', { name, generation }, voidSchema)
    },
    async relaySharedInbox(generation) {
      return await ipc.call('capture_shared_inbox_relay', { generation }, z.number())
    },
    async promoteScreenshot(spoolName, assetPath, maxDim, generation) {
      await ipc.call(
        'capture_screenshot_promote',
        { spoolName, assetPath, maxDim, generation },
        voidSchema,
      )
    },
  }
}

let defaultService: CaptureInboxService | null = null

/** The process-wide `CaptureInboxService`; one over the installed bridge unless replaced. */
export function defaultCaptureInbox(): CaptureInboxService {
  defaultService ??= createCaptureInboxService({ ipc: currentIpc() })
  return defaultService
}

/** Install the process-wide `CaptureInboxService`; `null` restores the one over the installed bridge. */
export function setDefaultCaptureInbox(service: CaptureInboxService | null): void {
  defaultService = service
}
