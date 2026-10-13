import { describe, expect, it, vi } from 'vitest'
import { textCaptureEnvelopeSchema } from '../capture/capture-envelope.ts'
import { MIN_VISIBLE_MS } from '../app/operations-service.ts'
import type { Unlisten } from '../unlisten.ts'
import { createTestCaptureInboxService } from '../testing/capture.ts'
import { createTestClockService } from '../testing/clock.ts'
import { createTestGraphSessionService } from '../testing/graph-session.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestDeepLinkService, createTestDeepLinkSource } from '../testing/navigation.ts'
import { createTestOperationsService } from '../testing/operations.ts'
import type { DeepLinkServiceDeps, DeepLinkSession } from './deep-link-service.ts'
import type { Route } from './route.ts'

function setup(overrides?: Partial<DeepLinkServiceDeps>) {
  const operations = createTestOperationsService()
  const captureInbox = createTestCaptureInboxService()
  const logger = createTestLoggerService()
  const resolveNoteTarget = vi.fn<(target: string) => Promise<string | null>>()
  const navigate = vi.fn<(route: Route) => void>()
  const graphSession = createTestGraphSessionService({ graph: { generation: 3 } })
  const service = createTestDeepLinkService({
    operations,
    captureInbox,
    logger,
    indexQuery: { resolveNoteTarget },
    graphSession,
    ...overrides,
  })
  const handle = (url: string) => service.handle(url, { navigate })
  return {
    service,
    operations,
    captureInbox,
    logger,
    resolveNoteTarget,
    navigate,
    graphSession,
    handle,
  }
}

describe('DeepLinkService.handle', () => {
  it('navigates self-contained routes directly, with no status noise', async () => {
    const { handle, navigate, resolveNoteTarget, operations } = setup()
    await handle('reflect://daily/2026-07-01')
    expect(navigate).toHaveBeenCalledWith({ kind: 'daily', date: '2026-07-01' })
    expect(resolveNoteTarget).not.toHaveBeenCalled()
    expect(operations.getAll()).toEqual([])
  })

  it('resolves a note target and navigates to its route', async () => {
    const { handle, navigate, resolveNoteTarget } = setup()
    resolveNoteTarget.mockResolvedValue('notes/project-x.md')

    await handle('reflect://note/Project%20X')

    expect(resolveNoteTarget).toHaveBeenCalledWith('Project X')
    expect(navigate).toHaveBeenCalledWith({ kind: 'note', path: 'notes/project-x.md' })
  })

  it('routes a daily-path resolution to the daily view', async () => {
    const { handle, navigate, resolveNoteTarget } = setup()
    resolveNoteTarget.mockResolvedValue('daily/2026-07-01.md')

    await handle('reflect://note/2026-07-01')

    expect(navigate).toHaveBeenCalledWith({ kind: 'daily', date: '2026-07-01' })
  })

  it('surfaces a failure instead of navigating when the target resolves to nothing', async () => {
    const { handle, navigate, resolveNoteTarget, operations } = setup()
    resolveNoteTarget.mockResolvedValue(null)

    await handle('reflect://note/ghost')

    expect(navigate).not.toHaveBeenCalled()
    expect(operations.snapshot()).toMatchObject([
      { label: 'Opening link', status: 'failed', message: 'Note not found: ghost' },
    ])
  })

  it('surfaces a resolution failure instead of rejecting the handler', async () => {
    const { handle, navigate, resolveNoteTarget, operations } = setup()
    resolveNoteTarget.mockRejectedValue(new Error('index unavailable'))

    await expect(handle('reflect://note/Project%20X')).resolves.toBeUndefined()

    expect(navigate).not.toHaveBeenCalled()
    expect(operations.snapshot()).toMatchObject([{ label: 'Opening link', status: 'failed' }])
  })

  it('drops a resolution failure that arrives after the link became stale', async () => {
    const { service, navigate, resolveNoteTarget, operations } = setup()
    let rejectResolve: (cause: Error) => void = () => {}
    resolveNoteTarget.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectResolve = reject
      }),
    )
    let stale = false
    const pending = service.handle('reflect://note/Project%20X', {
      navigate,
      isStale: () => stale,
    })

    stale = true
    rejectResolve(new Error('old index disappeared'))
    await pending

    expect(navigate).not.toHaveBeenCalled()
    expect(operations.getAll()).toEqual([])
  })

  it('drops a resolution that finished after the graph session ended', async () => {
    const { service, navigate, resolveNoteTarget, operations } = setup()
    const pendingResolve = Promise.withResolvers<string>()
    resolveNoteTarget.mockReturnValue(pendingResolve.promise)
    let stale = false

    const pending = service.handle('reflect://note/Project%20X', {
      navigate,
      isStale: () => stale,
    })
    stale = true
    pendingResolve.resolve('notes/project-x.md')
    await pending

    expect(navigate).not.toHaveBeenCalled()
    expect(operations.getAll()).toEqual([])
  })

  it('surfaces a failure on a URL the grammar rejects', async () => {
    const { handle, navigate, captureInbox, operations } = setup()
    await handle('reflect://edit-notes?content=evil')

    expect(navigate).not.toHaveBeenCalled()
    expect(captureInbox.spooled()).toEqual([])
    expect(operations.snapshot()).toMatchObject([
      {
        label: 'Opening link',
        status: 'failed',
        message: 'Unrecognized link: reflect://edit-notes?content=evil',
      },
    ])
  })

  it('spools a valid text-capture envelope for an append link', async () => {
    const clock = createTestClockService({ now: Date.UTC(2026, 6, 1, 12) })
    const { handle, navigate, captureInbox, operations } = setup({ clock })
    await handle('reflect://append?text=call%20the%20bank')

    expect(captureInbox.spooled()).toHaveLength(1)
    const { name, json, generation } = captureInbox.spooled()[0]!
    const envelope = textCaptureEnvelopeSchema.parse(JSON.parse(json))
    expect(name).toBe(`${envelope.id}.json`)
    expect(envelope.kind).toBe('append')
    expect(envelope.text).toBe('call the bank')
    expect(envelope.capturedAt).toBe('2026-07-01T12:00:00.000Z')
    expect(generation).toBe(3)
    expect(navigate).not.toHaveBeenCalled()
    expect(operations.snapshot()).toMatchObject([{ label: 'Added to today', status: 'running' }])
    await operations.clock.advance(MIN_VISIBLE_MS)
    expect(operations.getAll()).toEqual([])
  })

  it('spools a task envelope for a task link', async () => {
    const { handle, captureInbox, operations } = setup()
    await handle('reflect://task?text=buy+milk')

    const { json } = captureInbox.spooled()[0]!
    const envelope = textCaptureEnvelopeSchema.parse(JSON.parse(json))
    expect(envelope.kind).toBe('task')
    expect(envelope.text).toBe('buy milk')
    expect(operations.snapshot()).toMatchObject([
      { label: 'Task added to today', status: 'running' },
    ])
    await operations.clock.advance(MIN_VISIBLE_MS)
    expect(operations.getAll()).toEqual([])
  })

  it('spools a checkbox envelope for a checkbox link', async () => {
    const { handle, captureInbox, operations } = setup()
    await handle('reflect://checkbox?text=pack+a+bag')

    const { json } = captureInbox.spooled()[0]!
    const envelope = textCaptureEnvelopeSchema.parse(JSON.parse(json))
    expect(envelope.kind).toBe('checkbox')
    expect(envelope.text).toBe('pack a bag')
    expect(operations.snapshot()).toMatchObject([
      { label: 'Checkbox added to today', status: 'running' },
    ])
    await operations.clock.advance(MIN_VISIBLE_MS)
    expect(operations.getAll()).toEqual([])
  })

  it('surfaces a capture with no graph open instead of spooling it', async () => {
    const { handle, graphSession, captureInbox, operations } = setup()
    graphSession.setGraph(null)

    await handle('reflect://append?text=milk')

    expect(captureInbox.spooled()).toEqual([])
    expect(operations.snapshot()).toMatchObject([
      { label: 'Saving capture', status: 'failed', message: 'No graph is open.' },
    ])
  })

  it('surfaces a spool failure instead of claiming success', async () => {
    const { handle, operations } = setup({
      captureInbox: { spool: () => Promise.reject(new Error('stale generation')) },
    })

    await handle('reflect://append?text=milk')

    expect(operations.snapshot()).toMatchObject([{ label: 'Saving capture', status: 'failed' }])
  })
})

/**
 * A service over a source whose two calls are spies, so a case can count and fail them.
 */
function setupIntake() {
  const live = createTestDeepLinkSource()
  const onOpenUrl = vi.fn<(listener: (urls: string[]) => void) => Promise<Unlisten>>((listener) =>
    live.onOpenUrl(listener),
  )
  const getCurrent = vi.fn<() => Promise<string[] | null>>(() => Promise.resolve(null))
  const service = createTestDeepLinkService({ source: { onOpenUrl, getCurrent } })
  /**
   * Deliver to the subscription made by the last `onOpenUrl` call.
   */
  const pluginDeliver = (urls: string[]): void => {
    const callback = onOpenUrl.mock.calls.at(-1)?.[0]
    if (callback === undefined) {
      throw new Error('onOpenUrl was never subscribed')
    }
    callback(urls)
  }
  return { service, onOpenUrl, getCurrent, pluginDeliver }
}

describe('DeepLinkService intake', () => {
  it('subscribes to the source exactly once for the app lifetime', async () => {
    const { service, onOpenUrl, getCurrent } = setupIntake()
    await service.startListener()
    await service.startListener()
    expect(onOpenUrl).toHaveBeenCalledTimes(1)
    expect(getCurrent).toHaveBeenCalledTimes(1)
  })

  it('buffers the launch URL from getCurrent — onOpenUrl does not replay it', async () => {
    const { service, getCurrent } = setupIntake()
    getCurrent.mockResolvedValue(['reflect://note/launch-target'])
    await service.startListener()

    const handler = vi.fn()
    service.setHandler(handler)

    expect(handler).toHaveBeenCalledWith('reflect://note/launch-target')
  })

  it('retries after a failed subscription instead of latching disabled', async () => {
    const { service, onOpenUrl } = setupIntake()
    onOpenUrl.mockRejectedValueOnce(new Error('plugin not ready'))

    await expect(service.startListener()).rejects.toThrow('plugin not ready')
    await service.startListener()

    expect(onOpenUrl).toHaveBeenCalledTimes(2)
  })

  it('unlatches even when the teardown itself throws, keeping the original error', async () => {
    const { service, onOpenUrl, getCurrent } = setupIntake()
    onOpenUrl.mockResolvedValueOnce(() => {
      throw new Error('unlisten blew up')
    })
    getCurrent.mockRejectedValueOnce(new Error('ipc failure'))

    await expect(service.startListener()).rejects.toThrow('ipc failure')

    await service.startListener()
    expect(onOpenUrl).toHaveBeenCalledTimes(2)
  })

  it('tears down the subscription when getCurrent fails, so a retry cannot double-deliver', async () => {
    const { service, onOpenUrl, getCurrent, pluginDeliver } = setupIntake()
    const unlisten = vi.fn()
    onOpenUrl.mockResolvedValue(unlisten)
    getCurrent.mockRejectedValueOnce(new Error('ipc failure'))

    await expect(service.startListener()).rejects.toThrow('ipc failure')
    expect(unlisten).toHaveBeenCalledTimes(1)

    await service.startListener()
    const handler = vi.fn()
    service.setHandler(handler)
    pluginDeliver(['reflect://today'])

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('delivers straight to an attached handler', async () => {
    const { service, pluginDeliver } = setupIntake()
    await service.startListener()
    const handler = vi.fn()
    service.setHandler(handler)

    pluginDeliver(['reflect://today'])

    expect(handler).toHaveBeenCalledWith('reflect://today')
  })

  it('buffers URLs that arrive with no handler and replays them in order on attach', async () => {
    const { service, pluginDeliver } = setupIntake()
    await service.startListener()
    pluginDeliver(['reflect://today', 'reflect://tasks'])

    const handler = vi.fn()
    service.setHandler(handler)

    expect(handler.mock.calls).toEqual([['reflect://today'], ['reflect://tasks']])
  })

  it('delivers an in-app dispatch (a clicked note link) straight to the handler', () => {
    const { service } = setupIntake()
    const handler = vi.fn()
    service.setHandler(handler)

    service.dispatch('reflect://note/from-a-note-body')

    expect(handler).toHaveBeenCalledWith('reflect://note/from-a-note-body')
  })

  it('buffers an in-app dispatch when no handler is attached', () => {
    const { service } = setupIntake()
    service.dispatch('reflect://today')

    const handler = vi.fn()
    service.setHandler(handler)

    expect(handler).toHaveBeenCalledWith('reflect://today')
  })

  it('buffers again after the handler detaches (graph switch gap)', async () => {
    const { service, pluginDeliver } = setupIntake()
    await service.startListener()
    const first = vi.fn()
    service.setHandler(first)
    service.setHandler(null)

    pluginDeliver(['reflect://daily/2026-07-01'])
    expect(first).not.toHaveBeenCalled()

    const second = vi.fn()
    service.setHandler(second)
    expect(second).toHaveBeenCalledWith('reflect://daily/2026-07-01')
  })

  it('keeps the buffer of one service apart from another', () => {
    const first = createTestDeepLinkService()
    const second = createTestDeepLinkService()
    first.dispatch('reflect://today')

    const handler = vi.fn()
    second.setHandler(handler)

    expect(handler).not.toHaveBeenCalled()
  })

  it('delivers the launch URLs and later URLs of the test source', async () => {
    const source = createTestDeepLinkSource({ current: ['reflect://tasks'] })
    const service = createTestDeepLinkService({ source })
    const handler = vi.fn()
    service.setHandler(handler)

    await service.startListener()
    source.deliver(['reflect://today'])

    expect(source.subscriptionCount()).toBe(1)
    expect(handler.mock.calls).toEqual([['reflect://tasks'], ['reflect://today']])
    expect(service.dispatched()).toEqual([])
  })
})

describe('DeepLinkService.serve', () => {
  function serveSession(overrides?: Partial<DeepLinkServiceDeps>) {
    const context = setup(overrides)
    context.graphSession.setGraph({ generation: 7 })
    const probes: { stale: boolean }[] = []
    const session: DeepLinkSession = {
      navigate: context.navigate,
      beginNavigationIntent: () => {
        const probe = { stale: false }
        probes.push(probe)
        return () => probe.stale
      },
    }
    const stop = context.service.serve(session)
    return { ...context, probes, stop }
  }

  it('acts on dispatched URLs until stopped, then buffers for the next session', async () => {
    const { service, navigate, stop } = serveSession()

    service.dispatch('reflect://today')
    expect(navigate).toHaveBeenCalledWith({ kind: 'today' })

    stop()
    service.dispatch('reflect://tasks')
    expect(navigate).toHaveBeenCalledTimes(1)

    const next = vi.fn()
    service.setHandler(next)
    expect(next).toHaveBeenCalledWith('reflect://tasks')
  })

  it('drains the URLs that arrived before the session', () => {
    const context = setup()
    context.service.dispatch('reflect://tasks')

    context.service.serve({
      navigate: context.navigate,
      beginNavigationIntent: () => () => false,
    })

    expect(context.navigate).toHaveBeenCalledWith({ kind: 'tasks' })
  })

  it('pins a capture to the graph session open when serving started', async () => {
    const { service, graphSession, captureInbox } = serveSession()
    graphSession.setGraph({ generation: 8 })

    service.dispatch('reflect://append?text=milk')

    await vi.waitFor(() => expect(captureInbox.spooled()).toHaveLength(1))
    expect(captureInbox.spooled()[0]?.generation).toBe(7)
  })

  it('drops a note resolution whose navigation intent went stale', async () => {
    const { service, navigate, resolveNoteTarget, operations, probes } = serveSession()
    const pendingResolve = Promise.withResolvers<string>()
    resolveNoteTarget.mockReturnValue(pendingResolve.promise)

    service.dispatch('reflect://note/x')
    expect(probes).toHaveLength(1)
    probes[0]!.stale = true
    pendingResolve.resolve('notes/x.md')
    await Promise.resolve()
    await Promise.resolve()

    expect(navigate).not.toHaveBeenCalled()
    expect(operations.getAll()).toEqual([])
  })

  it('drops a note resolution that finished after the graph session ended', async () => {
    const { service, navigate, resolveNoteTarget, graphSession, operations } = serveSession()
    const pendingResolve = Promise.withResolvers<string>()
    resolveNoteTarget.mockReturnValue(pendingResolve.promise)

    service.dispatch('reflect://note/x')
    graphSession.setGraph({ generation: 8 })
    pendingResolve.resolve('notes/x.md')
    await Promise.resolve()
    await Promise.resolve()

    expect(navigate).not.toHaveBeenCalled()
    expect(operations.getAll()).toEqual([])
  })

  it.each(['reflect://today', 'reflect://note/y'])(
    'begins a navigation intent for address URL %s',
    (url) => {
      const { service, resolveNoteTarget, probes } = serveSession()
      resolveNoteTarget.mockResolvedValue(null)

      service.dispatch(url)

      expect(probes).toHaveLength(1)
    },
  )

  it.each([
    'reflect://append?text=captured',
    'reflect://task?text=captured',
    'reflect://edit-notes?content=invalid',
  ])('begins no navigation intent for non-navigation URL %s', (url) => {
    const { service, probes } = serveSession()

    service.dispatch(url)

    expect(probes).toEqual([])
  })

  it('logs a rejected handler instead of leaving an unhandled rejection', async () => {
    const { service, navigate, logger } = serveSession()
    const cause = new Error('router is gone')
    navigate.mockImplementation(() => {
      throw cause
    })

    service.dispatch('reflect://today')

    await vi.waitFor(() =>
      expect(logger.getErrors()).toEqual([{ message: 'deep link failed: reflect://today', cause }]),
    )
  })
})

describe('the initial-route slot', () => {
  it('holds the seeded route for the workspace mount', () => {
    const { service } = setup()
    expect(service.getInitialWindowRoute()).toBeNull()
    service.setInitialWindowRoute({ kind: 'note', path: 'notes/foo.md' })
    expect(service.getInitialWindowRoute()).toEqual({ kind: 'note', path: 'notes/foo.md' })
    // Idempotent reads: StrictMode double-invokes initializers.
    expect(service.getInitialWindowRoute()).toEqual({ kind: 'note', path: 'notes/foo.md' })
  })
})
