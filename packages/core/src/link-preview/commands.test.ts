import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultWebFetch } from '../app/web-fetch-service.ts'
import { cloudSafeLinkHref } from '../privacy/checkers.ts'
import { createTestWebFetchService } from '../testing/index.ts'
import { linkPreviewFetchHtml, linkPreviewFetchIcon } from './commands.ts'

function publicUrl(url: string) {
  return cloudSafeLinkHref({ path: 'notes/public.md', isPrivate: false }, url)
}

afterEach(() => {
  setDefaultWebFetch(null)
})

describe('link preview commands', () => {
  it('fetch through the installed web fetch service', async () => {
    const page = publicUrl('https://x.test')
    const icon = publicUrl('https://x.test/icon')
    const webFetch = createTestWebFetchService({
      html: { [page]: '<title>A</title>' },
      icon: { [icon]: 'data:image/png;base64,AAAA' },
    })
    setDefaultWebFetch(webFetch)

    await expect(linkPreviewFetchHtml(page)).resolves.toEqual({
      html: '<title>A</title>',
      finalUrl: page,
    })
    await expect(linkPreviewFetchIcon(icon)).resolves.toBe('data:image/png;base64,AAAA')
    expect(webFetch.requests()).toEqual([
      { kind: 'html', url: page },
      { kind: 'icon', url: icon },
    ])
  })
})
