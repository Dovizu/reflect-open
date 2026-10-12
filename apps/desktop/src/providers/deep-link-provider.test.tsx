import { StrictMode, type ReactElement } from 'react'
import { render } from 'vitest-browser-react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { GraphInfo } from '@reflect/core'
import {
  createTestAppServices,
  createTestCaptureInboxService,
  createTestDeepLinkService,
  createTestOperationsService,
  installTestServices,
} from '@reflect/core/testing'
import { RouterProvider } from '@/routing/router.tsx'
import { AppServicesProvider } from '@/services/services-provider.tsx'
import { DeepLinkProvider } from './deep-link-provider.tsx'

// The handler itself is covered in `@reflect/core`; these cover how the
// provider ties it to the router and to the graph session.

const GRAPH: GraphInfo = { root: '/g', name: 'g', generation: 7 }

function setup() {
  const resolveNoteTarget = vi.fn<(target: string) => Promise<string | null>>()
  const captureInbox = createTestCaptureInboxService()
  const operations = createTestOperationsService()
  const deepLink = createTestDeepLinkService({
    indexQuery: { resolveNoteTarget },
    captureInbox,
    operations,
  })
  const app = createTestAppServices({ deepLink, captureInbox, operations })
  onTestFinished(installTestServices(app))

  function tree(graph: GraphInfo = GRAPH): ReactElement {
    return (
      <AppServicesProvider services={app}>
        <RouterProvider>
          <DeepLinkProvider graph={graph}>{null}</DeepLinkProvider>
        </RouterProvider>
      </AppServicesProvider>
    )
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

  return { app, deepLink, captureInbox, resolveNoteTarget, tree, navigated, dispatchPendingNote }
}

describe('DeepLinkProvider', () => {
  it('serves the intake on mount and stops on unmount', async () => {
    const { deepLink, tree, navigated } = setup()
    deepLink.dispatch('reflect://tasks')
    expect(navigated()).toEqual([])

    const view = await render(tree())
    expect(navigated()).toEqual([{ kind: 'tasks' }])

    await view.unmount()
    deepLink.dispatch('reflect://today')
    expect(navigated()).toEqual([{ kind: 'tasks' }])
  })

  it('routes URLs into the service with the router and the session generation', async () => {
    const { deepLink, captureInbox, tree, navigated } = setup()
    await render(tree())

    deepLink.dispatch('reflect://today')
    deepLink.dispatch('reflect://append?text=x')

    expect(navigated()).toEqual([{ kind: 'today' }])
    await vi.waitFor(() => expect(captureInbox.spooled()).toHaveLength(1))
    expect(captureInbox.spooled()[0]?.generation).toBe(7)
  })

  it('drops an in-flight resolve when the graph session changes', async () => {
    const { tree, navigated, dispatchPendingNote } = setup()
    const view = await render(tree())
    const pending = dispatchPendingNote('x')

    await view.rerender(tree({ ...GRAPH, generation: 8 }))
    await pending.resolve()

    expect(navigated()).toEqual([])
  })

  it('drops a note resolve when navigation changes meanwhile', async () => {
    const { app, tree, navigated, dispatchPendingNote } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    app.navigation.navigate({ kind: 'tasks' })
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'tasks' }])
  })

  it('drops a note resolve when a newer note-link intent starts meanwhile', async () => {
    const { app, tree, navigated, dispatchPendingNote } = setup()
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
    const { deepLink, tree, navigated, dispatchPendingNote } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    deepLink.dispatch(url)
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'note', path: 'notes/x.md' }])
  })

  it('stales a pending note resolve for a newer navigation URL', async () => {
    const { deepLink, tree, navigated, dispatchPendingNote } = setup()
    await render(tree())
    const pending = dispatchPendingNote('x')

    deepLink.dispatch('reflect://today')
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'today' }])
  })

  it('stales a pending note resolve for a newer note URL', async () => {
    const { tree, navigated, dispatchPendingNote } = setup()
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
    const { tree, navigated, dispatchPendingNote } = setup()
    const pending = dispatchPendingNote('x')

    await render(<StrictMode>{tree()}</StrictMode>)
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'note', path: 'notes/x.md' }])
  })

  it('stays fresh after a plain unmount — staleness tracks the session, not the mount', async () => {
    const { tree, navigated, dispatchPendingNote } = setup()
    const view = await render(tree())
    const pending = dispatchPendingNote('x')

    await view.unmount()
    await pending.resolve()

    expect(navigated()).toEqual([{ kind: 'note', path: 'notes/x.md' }])
  })
})
