import { describe, expect, it, vi } from 'vitest'
import type { FileChange } from '@reflect/core'
import { renderInApp } from '@/test-utils/render-in-app.tsx'
import { useFileChanges } from './use-file-changes.ts'

function Host({ handler }: { handler: ((changes: FileChange[]) => void) | null }): null {
  useFileChanges(handler)
  return null
}

const UPSERT: FileChange[] = [{ path: 'notes/a.md', kind: 'upsert' }]

describe('useFileChanges', () => {
  it('delivers watcher events to the handler', async () => {
    const handler = vi.fn()
    const { app } = await renderInApp(<Host handler={handler} />)
    app.fileChanges.emit({ changes: UPSERT, source: 'external' })
    expect(handler).toHaveBeenCalledWith(UPSERT)
  })

  it('drops events after the teardown', async () => {
    const handler = vi.fn()
    const view = await renderInApp(<Host handler={handler} />)
    const subscribed = view.app.fileChanges.listenerCount().changes
    await view.unmount()
    view.app.fileChanges.emit({ changes: UPSERT, source: 'external' })
    expect(handler).not.toHaveBeenCalled()
    expect(view.app.fileChanges.listenerCount().changes).toBe(subscribed - 1)
  })

  it('resubscribes when the handler identity changes', async () => {
    const firstHandler = vi.fn()
    const view = await renderInApp(<Host handler={firstHandler} />)
    const subscribed = view.app.fileChanges.listenerCount().changes

    const nextHandler = vi.fn()
    await view.rerender(<Host handler={nextHandler} />)
    expect(view.app.fileChanges.listenerCount().changes).toBe(subscribed)

    view.app.fileChanges.emit({ changes: UPSERT, source: 'external' })
    expect(firstHandler).not.toHaveBeenCalled()
    expect(nextHandler).toHaveBeenCalledWith(UPSERT)
  })

  it('does nothing when disabled', async () => {
    const enabled = await renderInApp(<Host handler={vi.fn()} />)
    const subscribed = enabled.app.fileChanges.listenerCount().changes
    await enabled.rerender(<Host handler={null} />)
    expect(enabled.app.fileChanges.listenerCount().changes).toBe(subscribed - 1)
  })
})
