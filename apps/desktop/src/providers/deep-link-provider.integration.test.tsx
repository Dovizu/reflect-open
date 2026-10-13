import { describe, expect, it, vi } from 'vitest'
import { createTestAppServices, createTestDeepLinkService } from '@reflect/app/testing'
import {
  createTestCoreServices,
  createTestCaptureInboxService,
  createTestGraphSessionService,
} from '@reflect/core/testing'
import { renderInApp } from '@/test-utils/render-in-app.tsx'
import { DeepLinkProvider } from './deep-link-provider.tsx'

describe('DeepLinkProvider navigation intent integration', () => {
  it('keeps a deferred note resolution current when a capture arrives', async () => {
    const pendingResolution = Promise.withResolvers<string>()
    const resolveNoteTarget = vi.fn<(target: string) => Promise<string | null>>(
      () => pendingResolution.promise,
    )
    const captureInbox = createTestCaptureInboxService()
    const graphSession = createTestGraphSessionService()
    const app = createTestCoreServices({ captureInbox, graphSession })
    const appServices = createTestAppServices(app, {
      deepLink: createTestDeepLinkService({
        indexQuery: { resolveNoteTarget },
        captureInbox,
        graphSession,
      }),
    })
    await renderInApp(<DeepLinkProvider>{null}</DeepLinkProvider>, { app, appServices })

    appServices.deepLink.dispatch('reflect://note/Project%20X')
    expect(resolveNoteTarget).toHaveBeenCalledWith('Project X')

    appServices.deepLink.dispatch('reflect://append?text=captured%20while%20resolving')
    await vi.waitFor(() => expect(app.captureInbox.spooled()).toHaveLength(1))

    pendingResolution.resolve('notes/project-x.md')

    await vi.waitFor(() =>
      expect(appServices.navigation.navigations().map((call) => call.route)).toEqual([
        { kind: 'note', path: 'notes/project-x.md' },
      ]),
    )
  })
})
