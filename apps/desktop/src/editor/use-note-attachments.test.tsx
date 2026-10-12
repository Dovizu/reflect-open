import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, onTestFinished } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { setDefaultAttachments } from '@reflect/core'
import {
  createTestAppServices,
  createTestAttachmentService,
  createTestIpcBridgeService,
  installTestBridge,
  type TestAttachmentService,
} from '@reflect/core/testing'
import { useAttachmentCatalogSync } from '@/lib/attachment-catalog.ts'
import { AppServicesProvider } from '@/services/services-provider.tsx'
import { useNoteAttachments, type NoteAttachments } from './use-note-attachments.ts'

function assetUrl(generation: number, path: string): string {
  return `reflect-asset://localhost/${encodeURIComponent(`${generation}/${path}`)}`
}

const embed = (target: string) => ({ target, display: '', width: null, height: null })

let attachments: NoteAttachments | null = null

afterEach(() => {
  setDefaultAttachments(null)
  attachments = null
})

describe('useNoteAttachments', () => {
  it('resolves from the note it renders, with the process-wide service outside a provider', async () => {
    setDefaultAttachments(
      createTestAttachmentService({
        catalog: [
          { path: 'Projects/attachments/plan.png', size: 1 },
          { path: 'attachments/plan.png', size: 1 },
        ],
      }),
    )
    await renderHook(() => {
      attachments = useNoteAttachments(3, 'Projects/Plan.md')
    })

    expect(attachments?.resolveImageUrl('attachments/plan.png')).toBe(
      assetUrl(3, 'Projects/attachments/plan.png'),
    )
    expect(attachments?.resolveAttachmentPath('attachments/plan.png')).toBe(
      'Projects/attachments/plan.png',
    )
    expect(attachments?.resolveWikiEmbed(embed('Deep Work'))).toEqual({ kind: 'note' })
  })

  it('re-renders when the catalog changes', async () => {
    const services = createTestAppServices()
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <AppServicesProvider services={services}>{children}</AppServicesProvider>
    )
    let renders = 0
    const { act } = await renderHook(
      () => {
        renders += 1
        attachments = useNoteAttachments(3, 'Home.md')
      },
      { wrapper },
    )
    const rendersBefore = renders
    expect(attachments?.resolveImageUrl('garden-budget.png')).toBe(assetUrl(3, 'garden-budget.png'))

    await act(() => {
      services.attachments.setCatalog([{ path: 'attachments/garden-budget.png', size: 1 }])
      services.attachments.emitCatalogChanged()
    })

    expect(renders).toBeGreaterThan(rendersBefore)
    expect(attachments?.resolveImageUrl('garden-budget.png')).toBe(
      assetUrl(3, 'attachments/garden-budget.png'),
    )
  })
})

describe('useAttachmentCatalogSync', () => {
  it('watches the graph session catalog while mounted', async () => {
    const service: TestAttachmentService = createTestAttachmentService()
    setDefaultAttachments(service)
    onTestFinished(installTestBridge(createTestIpcBridgeService()))
    const view = await renderHook(
      ({ generation }: { generation: number | null } = { generation: null }) => {
        useAttachmentCatalogSync(generation)
      },
      { initialProps: { generation: 3 as number | null } },
    )
    expect(service.watchers()).toBe(1)

    await view.rerender({ generation: null })
    expect(service.watchers()).toBe(0)

    await view.rerender({ generation: 4 })
    expect(service.watchers()).toBe(1)
    await view.unmount()
    expect(service.watchers()).toBe(0)
  })
})
