import {
  retryUpdate,
  type AvailableUpdate,
  type UpdateDownloadEvent,
  type UpdaterAdapter,
  type UpdateService,
  type UpdateState,
} from '../app/update-service.ts'

export interface TestUpdaterOptions {
  /** The update `check()` offers; `null` or absent means the app is current. */
  available?: { version: string } | null
  /** When set, `check()` rejects with this message. */
  failCheck?: string
  /** When set, `downloadAndInstall` rejects with this message. */
  failInstall?: string
  /** When true, `downloadAndInstall` stays pending until {@link TestUpdaterAdapter.finishInstall}. */
  holdInstall?: boolean
}

export type TestUpdaterCall = 'check' | 'downloadAndInstall' | 'relaunch'

/** An {@link UpdaterAdapter} whose answers and download progress a test controls. */
export interface TestUpdaterAdapter extends UpdaterAdapter {
  /** Every adapter call, in order. */
  readonly calls: readonly TestUpdaterCall[]
  /** Replace the options that later calls answer with. */
  configure(options: TestUpdaterOptions): void
  /** Make the next `check()` wait; the returned function lets it answer. */
  holdNextCheck(): () => void
  /** Report `percent` of the held download as received. */
  progress(percent: number): void
  /** Settle the held download: `Finished` then resolve, or reject under `failInstall`. */
  finishInstall(): void
}

const CONTENT_LENGTH = 100

/** A test updater; the download reports a content length of 100 bytes. */
export function createTestUpdaterAdapter(initial?: TestUpdaterOptions): TestUpdaterAdapter {
  let options: TestUpdaterOptions = { ...initial }
  const calls: TestUpdaterCall[] = []
  let checkGate: Promise<void> | null = null
  let download: {
    onEvent: (event: UpdateDownloadEvent) => void
    received: number
    settle: () => void
  } | null = null

  function settleDownload(onEvent: (event: UpdateDownloadEvent) => void): Promise<void> {
    if (options.failInstall !== undefined) {
      return Promise.reject(new Error(options.failInstall))
    }
    onEvent({ event: 'Finished' })
    return Promise.resolve()
  }

  function offer(version: string): AvailableUpdate {
    return {
      version,
      downloadAndInstall(onEvent) {
        calls.push('downloadAndInstall')
        onEvent({ event: 'Started', data: { contentLength: CONTENT_LENGTH } })
        if (!options.holdInstall) {
          return settleDownload(onEvent)
        }
        const { promise, resolve, reject } = Promise.withResolvers<void>()
        download = {
          onEvent,
          received: 0,
          settle: () => settleDownload(onEvent).then(resolve, reject),
        }
        return promise
      },
    }
  }

  return {
    calls,
    async check() {
      calls.push('check')
      const gate = checkGate
      checkGate = null
      if (gate) {
        await gate
      }
      if (options.failCheck !== undefined) {
        throw new Error(options.failCheck)
      }
      return options.available ? offer(options.available.version) : null
    },
    async relaunch() {
      calls.push('relaunch')
    },
    configure(next) {
      options = { ...next }
    },
    holdNextCheck() {
      const { promise, resolve } = Promise.withResolvers<void>()
      checkGate = promise
      return resolve
    },
    progress(percent) {
      if (!download) {
        throw new Error('No download is in progress')
      }
      const target = Math.round((percent / 100) * CONTENT_LENGTH)
      download.onEvent({ event: 'Progress', data: { chunkLength: target - download.received } })
      download.received = target
    },
    finishInstall() {
      if (!download) {
        throw new Error('No download is in progress')
      }
      const { settle } = download
      download = null
      settle()
    },
  }
}

export type TestUpdateCall =
  | 'start'
  | 'checkNow'
  | 'install'
  | 'restart'
  | 'retryAction'
  | 'dispose'

/** An {@link UpdateService} whose state a test sets directly. */
export interface TestUpdateService extends UpdateService {
  /** Every action call, in order. */
  readonly calls: readonly TestUpdateCall[]
  /** Replace the state and notify subscribers. */
  setState(state: UpdateState): void
}

/** A supported update service that starts in `state` (idle by default); actions only record. */
export function createTestUpdateService(state?: UpdateState): TestUpdateService {
  let current: UpdateState = state ?? { phase: 'idle' }
  const listeners = new Set<() => void>()
  const calls: TestUpdateCall[] = []
  const service: TestUpdateService = {
    supported: true,
    calls,
    getState: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start() {
      calls.push('start')
    },
    async checkNow() {
      calls.push('checkNow')
    },
    async install() {
      calls.push('install')
    },
    async restart() {
      calls.push('restart')
    },
    retryAction() {
      calls.push('retryAction')
      return retryUpdate(service)
    },
    dispose() {
      calls.push('dispose')
    },
    setState(next) {
      current = next
      for (const listener of listeners) {
        listener()
      }
    },
  }
  return service
}
