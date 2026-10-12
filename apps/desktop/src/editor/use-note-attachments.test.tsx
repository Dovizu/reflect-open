import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { setBridge, setDefaultFileChanges, type GraphInfo } from '@reflect/core'
import { createTestFileChangeService, type TestFileChangeService } from '@reflect/core/testing'
import { queryClient } from '@/lib/query-client.ts'
import { useAttachmentCatalogSync } from '@/lib/attachment-catalog.ts'
import { useNoteAttachments, type NoteAttachments } from './use-note-attachments.ts'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (filePath: string, protocol = 'asset') =>
    `${protocol}://localhost/${encodeURIComponent(filePath)}`,
}))

const GRAPH: GraphInfo = { root: '/vault', name: 'Vault', generation: 3 }

interface FakeVault {
  listings: () => number
  setFiles: (paths: string[]) => void
  fileChanges: TestFileChangeService
}

/**
 * A bridge serving `list_attachments` from a mutable file list (after `gate`
 * settles), with a file-change fake.
 */
function installVault(paths: string[], gate: Promise<void> = Promise.resolve()): FakeVault {
  let files = paths
  const fileChanges = createTestFileChangeService()
  setDefaultFileChanges(fileChanges)
  const invoke = vi.fn(async (command: string) => {
    if (command !== 'list_attachments') return null
    await gate
    return files.map((path) => ({ path, size: path.length, modifiedMs: 0 }))
  })
  setBridge({
    invoke,
    invokeBinary: async () => null,
    listen: async () => () => {},
  })
  return {
    listings: () => invoke.mock.calls.filter(([command]) => command === 'list_attachments').length,
    setFiles: (next) => {
      files = next
    },
    fileChanges,
  }
}

function CatalogSync({ children }: { children: ReactNode }): ReactNode {
  useAttachmentCatalogSync(GRAPH.generation)
  return children
}

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>
      <CatalogSync>{children}</CatalogSync>
    </QueryClientProvider>
  )
}

let attachments: NoteAttachments | null = null

async function renderAttachments(notePath: string): Promise<void> {
  await renderHook(
    () => {
      attachments = useNoteAttachments(GRAPH.generation, notePath)
    },
    { wrapper },
  )
}

function assetUrl(path: string): string {
  return `reflect-asset://localhost/${encodeURIComponent(`${GRAPH.generation}/${path}`)}`
}

const embed = (target: string) => ({ target, display: '', width: null, height: null })

afterEach(() => {
  setBridge(null)
  setDefaultFileChanges(null)
  attachments = null
  queryClient.clear()
})

describe('useNoteAttachments', () => {
  it('answers synchronously once the catalog is loaded, preferring the file beside the note', async () => {
    installVault(['Projects/attachments/plan.png', 'attachments/plan.png'])
    await renderAttachments('Projects/Plan.md')

    await vi.waitFor(() => {
      expect(attachments?.resolveImageUrl('attachments/plan.png')).toBe(
        assetUrl('Projects/attachments/plan.png'),
      )
    })
  })

  it('waits for the catalog when it has not loaded yet', async () => {
    const listing = Promise.withResolvers<void>()
    installVault(['attachments/garden-budget.png'], listing.promise)
    await renderAttachments('Home.md')

    const url = attachments?.resolveImageUrl('garden-budget.png')
    expect(url).toBeInstanceOf(Promise)
    listing.resolve()
    await expect(url).resolves.toBe(assetUrl('attachments/garden-budget.png'))
  })

  it('hands out embed sources that read back as the same file', async () => {
    installVault(['Media/my photo #1.png', 'Media/100%.pdf'])
    await renderAttachments('Home.md')

    const image = attachments?.resolveWikiEmbed(embed('Media/my photo #1.png'))
    const file = attachments?.resolveWikiEmbed(embed('100%.pdf'))
    expect(image).toEqual({ kind: 'image', src: '/Media/my%20photo%20%231.png' })
    await vi.waitFor(() => {
      expect(attachments?.resolveAttachmentPath('/Media/my%20photo%20%231.png')).toBe(
        'Media/my photo #1.png',
      )
      expect(file?.kind === 'file' && attachments?.resolveAttachmentPath(file.href ?? '')).toBe(
        'Media/100%.pdf',
      )
    })
    expect(attachments?.resolveWikiEmbed(embed('Deep Work'))).toEqual({ kind: 'note' })
    expect(attachments?.resolveWikiEmbed(embed('../outside.png'))).toBeUndefined()
  })
})

describe('useAttachmentCatalogSync', () => {
  it('re-lists when an attachment changes, not when only a note does', async () => {
    const vault = installVault([])
    await renderAttachments('Home.md')
    await vi.waitFor(() => {
      expect(attachments?.resolveImageUrl('garden-budget.png')).toBe(assetUrl('garden-budget.png'))
    })

    vault.fileChanges.emit({
      changes: [{ path: 'Home.md', kind: 'upsert', modifiedMs: 1 }],
      source: 'external',
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(vault.listings()).toBe(1)

    vault.setFiles(['attachments/garden-budget.png'])
    vault.fileChanges.emit({
      changes: [{ path: 'attachments/garden-budget.png', kind: 'upsert', modifiedMs: 1 }],
      source: 'external',
    })
    await vi.waitFor(() => {
      expect(attachments?.resolveImageUrl('garden-budget.png')).toBe(
        assetUrl('attachments/garden-budget.png'),
      )
    })
    expect(vault.listings()).toBe(2)
  })

  it('re-lists on a folder-level reconcile request', async () => {
    const vault = installVault([])
    await renderAttachments('Home.md')
    await vi.waitFor(() => expect(vault.listings()).toBe(1))

    vault.fileChanges.emitReconcile()

    await vi.waitFor(() => expect(vault.listings()).toBe(2))
  })
})
