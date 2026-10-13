import type { ReactElement, ReactNode } from 'react'
import { act } from '@/test-utils/act.ts'
import { describe, expect, it, vi } from 'vitest'
import type { AppPlatform, AppServices, RecentGraph } from '@reflect/core'
import {
  createTestAppServices,
  createTestDialogService,
  createTestGraphSessionService,
  createTestMobileStorageService,
  createTestPlatformService,
} from '@reflect/core/testing'
import { useGraphServices } from '@/services/services-provider.tsx'
import { renderInApp } from '@/test-utils/render-in-app.tsx'
import { GraphProvider, useGraph } from './graph-provider.tsx'

/**
 * The graph session and the mobile onboarding are covered in `@reflect/core`.
 * These cover the provider as their React shell. They mount it themselves:
 * `renderInApp` reports a graph over the session, which hides the opens.
 */

/** The fixed mobile roots the test storage reports. */
const MOBILE_ROOT = '/Documents'
const ICLOUD_ROOT = '/iCloud/Documents'

function tree(children: ReactNode, platform?: AppPlatform): ReactElement {
  return <GraphProvider {...(platform === undefined ? {} : { platform })}>{children}</GraphProvider>
}

/** Mount the provider over `app` and read its context. */
async function renderGraph<App extends AppServices>(app: App, platform?: AppPlatform) {
  let current: ReturnType<typeof useGraph> | null = null
  function Probe(): null {
    current = useGraph()
    return null
  }
  await renderInApp(tree(<Probe />, platform), { app, servicesOnly: true })
  return {
    app,
    result: {
      get current(): ReturnType<typeof useGraph> {
        if (current === null) {
          throw new Error('the graph context has not rendered')
        }
        return current
      },
    },
  }
}

describe('GraphProvider', () => {
  it('starts at the chooser when there are no recents', async () => {
    const { result } = await renderGraph(createTestAppServices())
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))
    expect(result.current.graph).toBeNull()
  })

  it('returns to the graph chooser without opening the folder picker', async () => {
    const recents: RecentGraph[] = [{ root: '/known', name: 'known', openedMs: 1 }]
    const dialog = createTestDialogService()
    const { result } = await renderGraph(
      createTestAppServices({
        dialog,
        graphSession: createTestGraphSessionService({ dialog, recents }),
      }),
    )
    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.graph?.root).toBe('/known')

    await act(async () => {
      await result.current.chooseGraph()
    })

    expect(result.current.status).toBe('choosing')
    expect(result.current.graph).toBeNull()
    expect(result.current.indexGeneration).toBeNull()
    expect(dialog.calls()).toEqual([])
    expect(result.current.recents).toEqual(recents)
  })

  it('opens a picked folder and seeds the empty graph', async () => {
    const { app, result } = await renderGraph(createTestAppServices())
    app.dialog.setFolder('/fresh')
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    await act(async () => {
      await result.current.pickAndOpen()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.graph?.root).toBe('/fresh')
    // The welcome note is written, and the graph is marked as seeded.
    expect(app.noteFile.writes()).toHaveLength(1)
    await expect(app.indexStore.getMeta('welcomeSeeded')).resolves.toBe('true')
  })

  it('boots the app’s graph session and passes its actions through', async () => {
    const { app, result } = await renderGraph(createTestAppServices())
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    await act(async () => {
      await result.current.openRecent('/a')
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.graph).toEqual({ root: '/a', name: 'a', generation: 1 })
    expect(result.current.indexGeneration).toBe(1)
    expect(app.graphSession.getState().graph?.root).toBe('/a')
  })

  it('provides the open session’s graph services', async () => {
    function SessionRoot() {
      const { session, role } = useGraphServices()
      return (
        <p>
          {role} {session.root}
        </p>
      )
    }
    function Probe() {
      const { status, openRecent } = useGraph()
      if (status === 'ready') {
        return <SessionRoot />
      }
      return (
        <button
          type="button"
          disabled={status !== 'choosing'}
          onClick={() => void openRecent('/a')}
        >
          Open
        </button>
      )
    }
    const app = createTestAppServices()
    const screen = await renderInApp(tree(<Probe />), { app, servicesOnly: true })

    await screen.getByRole('button', { name: 'Open' }).click()

    await expect.element(screen.getByText('main /a')).toBeVisible()
    expect(app.graphSession.getState().session?.signal.aborted).toBe(false)
  })
})

describe('GraphProvider mobile onboarding (Plans 19/21)', () => {
  it('boots the app’s mobile onboarding and opens no graph before a choice', async () => {
    const storage = {
      localRoot: MOBILE_ROOT,
      icloudDocumentsRoot: ICLOUD_ROOT,
      icloudGraphRoots: [],
    }
    const { app, result } = await renderGraph(
      createTestAppServices({
        platform: createTestPlatformService({ appPlatform: 'ios' }),
        mobileStorage: createTestMobileStorageService({ storage }),
      }),
      'ios',
    )

    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))
    expect(result.current.status).toBe('choosing')
    expect(result.current.graph).toBeNull()
    await vi.waitFor(() => expect(result.current.mobileStorageInfo).toEqual(storage))
    expect(result.current.mobileStorageResolving).toBe(false)
    expect(app.graphSession.getState().graph).toBeNull()
  })

  it('publishes the app’s mobile onboarding and passes completeOnboarding through', async () => {
    const { app, result } = await renderGraph(
      createTestAppServices({
        platform: createTestPlatformService({ appPlatform: 'ios' }),
      }),
      'ios',
    )
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))
    await vi.waitFor(() => expect(result.current.mobileStorageResolving).toBe(false))

    await act(async () => {
      await result.current.completeOnboarding('local')
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.needsOnboarding).toBe(false)
    expect(result.current.graph?.root).toBe('/local/Documents')
    expect(result.current.mobileStorageKind).toBe('local')
    expect(app.mobileOnboarding.getState().kind).toBe('local')
    await vi.waitFor(() => expect(app.settings.saves().at(-1)?.mobileOnboarded).toBe(true))
  })
})
