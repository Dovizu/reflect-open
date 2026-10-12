import { render } from 'vitest-browser-react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { GraphInfo } from '@reflect/core'
import {
  createTestAppServices,
  createTestCaptureInboxService,
  createTestDeepLinkService,
  installTestServices,
} from '@reflect/core/testing'
import { dispatchDeepLink } from '@/lib/deep-links/intake.ts'
import { RouterProvider } from '@/routing/router.tsx'
import { DeepLinkProvider } from './deep-link-provider.tsx'

const GRAPH: GraphInfo = { root: '/g', name: 'g', generation: 7 }

describe('DeepLinkProvider navigation intent integration', () => {
  it('keeps a deferred note resolution current when a capture arrives', async () => {
    const pendingResolution = Promise.withResolvers<string>()
    const resolveNoteTarget = vi.fn<(target: string) => Promise<string | null>>(
      () => pendingResolution.promise,
    )
    const captureInbox = createTestCaptureInboxService()
    const app = createTestAppServices({
      captureInbox,
      deepLink: createTestDeepLinkService({ indexQuery: { resolveNoteTarget }, captureInbox }),
    })
    onTestFinished(installTestServices(app))
    // Outside an `AppServicesProvider`: the provider and the free functions
    // meet on the process-wide service.
    await render(
      <RouterProvider>
        <DeepLinkProvider graph={GRAPH}>{null}</DeepLinkProvider>
      </RouterProvider>,
    )

    dispatchDeepLink('reflect://note/Project%20X')
    expect(resolveNoteTarget).toHaveBeenCalledWith('Project X')

    dispatchDeepLink('reflect://append?text=captured%20while%20resolving')
    await vi.waitFor(() => expect(app.captureInbox.spooled()).toHaveLength(1))

    pendingResolution.resolve('notes/project-x.md')

    await vi.waitFor(() =>
      expect(app.navigation.navigations().map((call) => call.route)).toEqual([
        { kind: 'note', path: 'notes/project-x.md' },
      ]),
    )
  })
})
