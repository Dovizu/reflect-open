import { describe, expect, it } from 'vitest'
import type { GraphInfo } from '@reflect/core'
import {
  createTestAppServices,
  createTestCaptureService,
  createTestWindowService,
} from '@reflect/core/testing'
import { renderWithServices } from '@/test-utils/render-with-services.tsx'
import { CaptureProvider } from './capture-provider.tsx'

const GRAPH: GraphInfo = { root: '/g', name: 'g', generation: 7 }

describe('CaptureProvider', () => {
  it('opens and starts a capture session for the graph', async () => {
    const view = await renderWithServices(<CaptureProvider graph={GRAPH}>child</CaptureProvider>)

    await expect.element(view.getByText('child')).toBeVisible()
    expect(view.app.capture.sessions()).toEqual([
      { generation: 7, starts: 1, schedules: 0, disposed: false },
    ])
  })

  it('disposes the session on unmount', async () => {
    const view = await renderWithServices(<CaptureProvider graph={GRAPH}>{null}</CaptureProvider>)
    await view.unmount()

    expect(view.app.capture.sessions()).toEqual([
      { generation: 7, starts: 1, schedules: 0, disposed: true },
    ])
  })

  it('opens a new session when the graph generation changes', async () => {
    const view = await renderWithServices(<CaptureProvider graph={GRAPH}>{null}</CaptureProvider>)
    await view.rerender(
      <CaptureProvider graph={{ ...GRAPH, generation: 8 }}>{null}</CaptureProvider>,
    )

    expect(view.app.capture.sessions()).toEqual([
      { generation: 7, starts: 1, schedules: 0, disposed: true },
      { generation: 8, starts: 1, schedules: 0, disposed: false },
    ])
  })

  it('opens no session in a note window: the main window owns the drain', async () => {
    const capture = createTestCaptureService()
    const app = createTestAppServices({
      capture,
      window: createTestWindowService({ label: 'note-1' }),
    })
    await renderWithServices(<CaptureProvider graph={GRAPH}>{null}</CaptureProvider>, { app })

    expect(capture.sessions()).toEqual([])
  })
})
