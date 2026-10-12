import { afterEach, beforeEach, vi, type Mock } from 'vitest'
import {
  createDefaultLinkNavigationDeps,
  createLinkNavigationService,
  setDefaultLinkNavigation,
  type LinkNavigationService,
  type LinkNavigationServiceDeps,
} from '@reflect/core'
import { createTestPlatformService, createTestWindowService } from '@reflect/core/testing'

export interface TestLinkNavigation {
  /** The `LinkNavigationService` of the running test. */
  service(): LinkNavigationService
  /**
   * The spy that receives the `reflect://` link of every note window the
   * running test opens. An open succeeds unless the test says otherwise.
   */
  openNoteWindow: Mock<(deepLink: string) => boolean | Promise<boolean>>
}

/**
 * Give every test of the calling file a fresh `LinkNavigationService`,
 * installed as the process-wide default. It runs over the other process-wide
 * defaults, on a desktop native shell whose note windows go to the
 * `openNoteWindow` spy. `overrides` replace single dependencies. Call it at
 * the top level of a test file.
 */
export function installTestLinkNavigation(
  overrides?: Partial<LinkNavigationServiceDeps>,
): TestLinkNavigation {
  const openNoteWindow = vi.fn<(deepLink: string) => boolean | Promise<boolean>>()
  let current: LinkNavigationService | null = null

  beforeEach(() => {
    openNoteWindow.mockReset().mockResolvedValue(true)
    current = createLinkNavigationService({
      ...createDefaultLinkNavigationDeps(),
      platform: createTestPlatformService(),
      window: createTestWindowService({ openNoteWindow }),
      ...overrides,
    })
    setDefaultLinkNavigation(current)
  })

  afterEach(() => {
    setDefaultLinkNavigation(null)
  })

  return {
    service: () => {
      if (current === null) {
        throw new Error('installTestLinkNavigation: no test is running')
      }
      return current
    },
    openNoteWindow,
  }
}
