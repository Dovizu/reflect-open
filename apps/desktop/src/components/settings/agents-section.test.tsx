import { page } from 'vitest/browser'
import type { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSkillService, AgentSkillStatus } from '@reflect/core'
import {
  createTestAppServices,
  createTestPlatformService,
  type TestGraphSessionService,
  type TestPlatformOptions,
} from '@reflect/core/testing'
import { queryKeys } from '@/lib/query-client.ts'
import { renderInApp } from '@/test-utils/render-in-app.tsx'
import { AgentsSection } from './agents-section.tsx'

const GRAPH = { root: '/graphs/Personal', name: 'Personal', generation: 7 }

type InstallState = 'missing' | 'current' | 'stale' | 'conflict'

let installState: InstallState
let installGenerations: number[]
let uninstallGenerations: number[]
let installResult: () => Promise<AgentSkillStatus>
let uninstallResult: () => Promise<AgentSkillStatus>

function statusPayload(): AgentSkillStatus {
  return {
    skillName: 'reflect-personal',
    skillPath: '/Users/me/.agents/skills/reflect-personal/SKILL.md',
    cliPath: '/Applications/Reflect.app/Contents/MacOS/reflect',
    installState,
  }
}

const agentSkill: AgentSkillService = {
  status: async () => statusPayload(),
  install: async (generation) => {
    installGenerations.push(generation)
    return await installResult()
  },
  uninstall: async (generation) => {
    uninstallGenerations.push(generation)
    return await uninstallResult()
  },
}

interface SectionView {
  graphSession: TestGraphSessionService
  queryClient: QueryClient
}

async function renderSection(platform?: TestPlatformOptions): Promise<SectionView> {
  const app = createTestAppServices({ agentSkill, platform: createTestPlatformService(platform) })
  const { queryClient } = await renderInApp(<AgentsSection />, { app, graph: GRAPH })
  return { graphSession: app.graphSession, queryClient }
}

beforeEach(() => {
  installState = 'missing'
  installGenerations = []
  uninstallGenerations = []
  installResult = async () => {
    installState = 'current'
    return statusPayload()
  }
  uninstallResult = async () => {
    installState = 'missing'
    return statusPayload()
  }
})

describe('AgentsSection', () => {
  it('installs the skill with the graph generation pinned', async () => {
    await renderSection()
    await page.getByRole('button', { name: 'Install skill' }).click()

    await expect.element(page.getByText('Installed')).toBeInTheDocument()
    expect(installGenerations).toEqual([GRAPH.generation])
    await expect
      .element(page.getByText('/Users/me/.agents/skills/reflect-personal/SKILL.md'))
      .toBeInTheDocument()
  })

  it('updates a stale install with the graph generation pinned', async () => {
    installState = 'stale'
    await renderSection()

    await page.getByRole('button', { name: 'Update skill' }).click()
    await expect.element(page.getByText('Installed')).toBeInTheDocument()
    expect(installGenerations).toEqual([GRAPH.generation])
  })

  it('removes any managed install with the graph generation pinned', async () => {
    installState = 'stale'
    await renderSection()

    await page.getByRole('button', { name: 'Remove' }).click()
    await expect.element(page.getByRole('button', { name: 'Install skill' })).toBeInTheDocument()
    expect(uninstallGenerations).toEqual([GRAPH.generation])
  })

  it('disables all actions while one mutation is pending', async () => {
    installState = 'stale'
    installResult = () => new Promise<AgentSkillStatus>(() => {})
    await renderSection()

    await page.getByRole('button', { name: 'Update skill' }).click()
    await expect.element(page.getByRole('button', { name: 'Update skill' })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })

  it('shows mutation errors and clears them when retrying', async () => {
    let shouldFail = true
    installResult = async () => {
      if (shouldFail) {
        throw new Error('Installing failed')
      }
      installState = 'current'
      return statusPayload()
    }
    await renderSection()

    await page.getByRole('button', { name: 'Install skill' }).click()
    await expect.element(page.getByText('Installing failed')).toBeInTheDocument()

    shouldFail = false
    await page.getByRole('button', { name: 'Install skill' }).click()
    await expect.element(page.getByText('Installed')).toBeInTheDocument()
    expect(page.getByText('Installing failed').query()).toBeNull()
  })

  it('does not carry a mutation error to another graph', async () => {
    installResult = () => Promise.reject(new Error('Installing failed'))
    const view = await renderSection()
    await page.getByRole('button', { name: 'Install skill' }).click()
    await expect.element(page.getByText('Installing failed')).toBeInTheDocument()

    view.graphSession.setGraph({ root: '/graphs/Work', name: 'Work', generation: 11 })

    await expect.element(page.getByRole('button', { name: 'Install skill' })).toBeEnabled()
    expect(page.getByText('Installing failed').query()).toBeNull()
  })

  it('writes a completed mutation to its original graph cache', async () => {
    const pendingInstall = Promise.withResolvers<AgentSkillStatus>()
    installResult = () => pendingInstall.promise
    const { graphSession, queryClient } = await renderSection()
    await page.getByRole('button', { name: 'Install skill' }).click()

    const nextGraph = { root: '/graphs/Work', name: 'Work', generation: 11 }
    graphSession.setGraph(nextGraph)
    await vi.waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.agentSkill.status(nextGraph.root))?.status).toBe(
        'success',
      ),
    )
    await expect.element(page.getByRole('button', { name: 'Install skill' })).toBeEnabled()
    const nextStatus = { ...statusPayload(), skillPath: '/work/SKILL.md' }
    queryClient.setQueryData(queryKeys.agentSkill.status(nextGraph.root), nextStatus)

    installState = 'current'
    pendingInstall.resolve(statusPayload())
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.agentSkill.status(GRAPH.root))).toEqual(
        statusPayload(),
      ),
    )
    expect(queryClient.getQueryData(queryKeys.agentSkill.status(nextGraph.root))).toEqual(
      nextStatus,
    )
  })

  it('refuses to touch an unmanaged file', async () => {
    installState = 'conflict'
    await renderSection()

    await expect.element(page.getByText(/Reflect doesn’t manage/)).toBeInTheDocument()
    expect(page.getByRole('button', { name: 'Install skill' }).query()).toBeNull()
    expect(page.getByRole('button', { name: 'Remove' }).query()).toBeNull()
  })
})

describe('AgentsSection off macOS desktop', () => {
  it('renders nothing off macOS desktop', async () => {
    await renderSection({ isNativeShell: false, isMacosDesktop: false })
    expect(page.getByText('Agent skill').query()).toBeNull()
  })
})
