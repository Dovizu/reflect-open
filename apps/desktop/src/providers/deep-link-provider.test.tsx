import { StrictMode, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  createTestAppServices,
  createTestCaptureInboxService,
  createTestDeepLinkService,
  createTestGraphSessionService,
  createTestOperationsService,
} from '@reflect/core/testing'
import { act } from '@/test-utils/act.ts'
import { renderInApp } from '@/test-utils/render-in-app.tsx'
import { DeepLinkProvider } from './deep-link-provider.tsx'

// The handler itself is covered in `@reflect/core`; these cover how the
// provider ties it to the router and to the graph session.

const GRAPH = { root: '/g', name: 'g', generation: 7 }

function setup() {
  const resolveNoteTarget = vi.fn<(target: string) => Promise<string | null>>()
  const captureInbox = createTestCaptureInboxService()
  const operations = createTestOperationsService()
  const graphSession = createTestGraphSessionService()
  const deepLink = createTestDeepLinkService({
    indexQuery: { resolveNoteTarget },
    captureInbox,
    operations,
    graphSession,
  })
  const app = createTestAppServices({ deepLink, captureInbox, operations, graphSession })

  function tree(): ReactElement {
    return <DeepLinkProvider>{null}</DeepLinkProvider>
  }

  /** Render under the app's router with `GRAPH` open, as the workspace mounts the provider. */
  async function render(ui: ReactNode) {
    return await renderInApp(ui, { app, graph: GRAPH })
  }

  /** The routes navigated to so far, in order. */
  const navigated = () => app.navigation.navigations().map((call) => call.route)

  /** Dispatch a note link whose resolution stays pending until it is resolved. */
  function dispatchPendingNote(target: string) {
    const pending = Promise.withResolvers<string | null>()
    resolveNoteTarget.mockReturnValueOnce(pending.promise)
    deepLink.dispatch(`reflect://note/${target}`)
    return {
      resolve: async () => {
        pending.resolve(`notes/${target}.md`)
        // Let the handler continue past the resolution.
        await new Promise((resolve) => setTimeout(resolve, 0))
      },
    }
  }

  return {
    app,
    deepLink,
    captureInbox,
    resolveNoteTarget,
    tree,
    render,
    navigated,
    dispatchPendingNote,
  }
}

describe('DeepLinkProvider', () => {
  it('serves the intake on mount and stops on unmount', async () => {
    const { deepLink, tree, navigated, render } = setup()
    deepLink.dispatch('reflect://tasks')
    expect(navigated()).toEqual([])

    const view = await render(tree())
    expect(navigated()).toEqual([{ kind: 'tasks' }])

    await view.unmount()
    deepLink.dispatch('reflect://today')
    expect(navigated()).toEqual([{ kind: 'tasks' }])
  })

  it('routes URLs into the service with the router and the open graph session', async () => {
    const { deepLink, captureInbox, tree, navigated, render } = setup()
    await render(tree())

    deepLink.dispatch('reflect://today')
    deepLink.dispatch('reflect://append?text=x')

    expect(navigated()).toEqual([{ kind: 'today' }])
    await vi.waitFor(() => expect(captureInbox.spooled()).toHaveLength(1))
    expect(captureInbox.spooled()[0]?.generation).toBe(7)
  })

  it('drops an in-flight resolve when the graph session changes', async () => {
    const { app, tree, navigated, dispatchPendingNote, render } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    act(() => app.graphSession.setGraph({ ...GRAPH, generation: 8 }))
    await pending.resolve()

    expect(navigated()).toEqual([])
  })

  it('serves the next graph session once the graph changes', async () => {
    const { app, deepLink, captureInbox, tree, render } = setup()
    await render(tree())

    act(() => app.graphSession.setGraph({ ...GRAPH, generation: 8 }))
    deepLink.dispatch('reflect://append?text=x')

    await vi.waitFor(() => expect(captureInbox.spooled()).toHaveLength(1))
    expect(captureInbox.spooled()[0]?.generation).toBe(8)
  })

  it('drops a note resolve when navigation changes meanwhile', async () => {
    const { app, tree, navigated, dispatchPendingNote, render } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    app.navigation.navigate({ kind: 'tasks' })
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'tasks' }])
  })

  it('drops a note resolve when a newer note-link intent starts meanwhile', async () => {
    const { app, tree, navigated, dispatchPendingNote, render } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    app.linkNavigation.beginIntent()
    await pending.resolve()

    expect(navigated()).toEqual([])
  })

  it.each([
    'reflect://append?text=captured',
    'reflect://task?text=captured',
    'reflect://edit-notes?content=invalid',
  ])('does not stale a pending note resolve for non-navigation URL %s', async (url) => {
    const { deepLink, tree, navigated, dispatchPendingNote, render } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    deepLink.dispatch(url)
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'note', path: 'notes/x.md' }])
  })

  it('stales a pending note resolve for a newer navigation URL', async () => {
    const { deepLink, tree, navigated, dispatchPendingNote, render } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    deepLink.dispatch('reflect://today')
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'today' }])
  })

  it('stales a pending note resolve for a newer note URL', async () => {
    const { tree, navigated, dispatchPendingNote, render } = setup()
    await render(tree())
    const older = dispatchPendingNote('x')
    const newer = dispatchPendingNote('y')

    await older.resolve()
    await newer.resolve()

    expect(navigated()).toEqual([{ kind: 'note', path: 'notes/y.md' }])
  })

  it('a StrictMode probe cycle does not stale a link the probe attach drained', async () => {
    // The note window's initial deep link buffers in the intake and is drained
    // by the FIRST attach — which in dev is StrictMode's probe run. Its async
    // note resolution must survive the probe's detach/reattach (same session),
    // or ⌘-clicked windows open on Today instead of the note.
    const { tree, navigated, dispatchPendingNote, render } = setup()
    const pending = dispatchPendingNote('x')

    await render(<StrictMode>{tree()}</StrictMode>)
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'note', path: 'notes/x.md' }])
  })

  it('stays fresh after a plain unmount — staleness tracks the session, not the mount', async () => {
    const { tree, navigated, dispatchPendingNote, render } = setup()
    const view = await render(tree())
    const pending = dispatchPendingNote('x')

    await view.unmount()
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'note', path: 'notes/x.md' }])
  })
})
