import { act, type ReactNode } from 'react'
import { cleanup, renderHook } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import type { LinkClickHandler } from '@meowdown/core'
import { setDefaultAttachments, setDefaultOpener } from '@reflect/core'
import {
  createTestAttachmentService,
  createTestOpenerService,
  type TestAttachmentService,
  type TestOpenerService,
} from '@reflect/core/testing'
import { useMarkdownLinkClick } from '@/editor/use-markdown-link-click.ts'
import { RouterProvider, useRouter } from '@/routing/router.tsx'
import { installTestLinkNavigation } from '@/test-utils/link-navigation.ts'

const dispatchDeepLink = vi.fn<(url: string) => void>()
const resolveMarkdownHref = vi.fn()
const { openNoteWindow } = installTestLinkNavigation({
  deepLink: { dispatch: dispatchDeepLink },
  noteLinkResolver: { resolveWikiTarget: vi.fn(), resolveMarkdownHref },
})

function RouteProbe(): ReactNode {
  const { route } = useRouter()
  return <output data-testid="route">{JSON.stringify(route)}</output>
}

function Providers({ children }: { children: ReactNode }): ReactNode {
  return (
    <RouterProvider>
      {children}
      <RouteProbe />
    </RouterProvider>
  )
}

const route = page.getByTestId('route')

let onLinkClick: LinkClickHandler

async function mount(generation: number | null, sourcePath: string | null): Promise<void> {
  const { result } = await renderHook(() => useMarkdownLinkClick(generation, sourcePath), {
    wrapper: Providers,
  })
  onLinkClick = result.current
}

function click(href: string, metaKey = false): MouseEvent {
  const event = new MouseEvent('click', { cancelable: true, metaKey })
  act(() => onLinkClick({ href, event, mod: metaKey }))
  return event
}

let opener: TestOpenerService
let attachments: TestAttachmentService

beforeEach(async () => {
  vi.clearAllMocks()
  opener = createTestOpenerService()
  setDefaultOpener(opener)
  attachments = createTestAttachmentService()
  setDefaultAttachments(attachments)
  resolveMarkdownHref.mockResolvedValue({ kind: 'missing' })
  await mount(7, 'projects/TASKS.md')
})

afterEach(() => {
  cleanup()
  setDefaultAttachments(null)
})

describe('useMarkdownLinkClick', () => {
  it('opens an http(s) link in the OS browser and blocks the frame navigation', async () => {
    const event = click('https://example.com')

    expect(opener.openedUrls()).toEqual(['https://example.com'])
    expect(event.defaultPrevented).toBe(true)
  })

  it('routes a reflect:// link through the in-app deep-link intake, not the URL opener', async () => {
    click('reflect://note/abc123')

    expect(dispatchDeepLink).toHaveBeenCalledWith('reflect://note/abc123')
    expect(opener.openedUrls()).toEqual([])
  })

  it('⌘-clicks a rendered reflect:// link into a secondary window', async () => {
    click('reflect://note/abc123', true)

    await vi.waitFor(() => expect(openNoteWindow).toHaveBeenCalledWith('reflect://note/abc123'))
    expect(dispatchDeepLink).not.toHaveBeenCalled()
  })

  it('opens a custom app scheme in its OS default app', async () => {
    const event = click('x-devonthink-item://40C88434-68B6-4DCB-A258-754679764C3C')

    expect(opener.openedUrls()).toEqual([
      'x-devonthink-item://40C88434-68B6-4DCB-A258-754679764C3C',
    ])
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['file:///etc/passwd'],
    ['blob:https://example.com/uuid'],
  ])('drops the unsafe scheme %s without opening anything', (href) => {
    const event = click(href)

    expect(opener.openedUrls()).toEqual([])
    expect(dispatchDeepLink).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('opens a relative note link from the source note', async () => {
    resolveMarkdownHref.mockResolvedValue({
      kind: 'resolved',
      path: 'projects/roadmap/plan.md',
    })
    const event = click('./roadmap/plan.md')

    expect(resolveMarkdownHref).toHaveBeenCalledWith('projects/TASKS.md', './roadmap/plan.md', 7)
    await expect
      .element(route)
      .toMatchTextContent('{"kind":"note","path":"projects/roadmap/plan.md"}')
    expect(opener.openedUrls()).toEqual([])
    expect(event.defaultPrevented).toBe(true)
  })

  it('opens an attachment link through the graph asset opener, not the URL opener', async () => {
    click('assets/cat.png')

    await vi.waitFor(() => expect(attachments.opened()).toEqual(['assets/cat.png']))
    expect(opener.openedUrls()).toEqual([])
    expect(resolveMarkdownHref).not.toHaveBeenCalled()
  })

  it('drops attachment and note links when the Markdown belongs to no note', async () => {
    await mount(7, null)

    const asset = click('assets/cat.png')
    const note = click('notes/foo.md')

    expect(attachments.opened()).toEqual([])
    expect(resolveMarkdownHref).not.toHaveBeenCalled()
    expect(opener.openedUrls()).toEqual([])
    expect(dispatchDeepLink).not.toHaveBeenCalled()
    expect(asset.defaultPrevented).toBe(true)
    expect(note.defaultPrevented).toBe(true)
  })
})
