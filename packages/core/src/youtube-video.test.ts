import { afterEach, expect, it, vi } from 'vitest'
import { setDefaultWebFetch } from './app/web-fetch-service.ts'
import { createTestWebFetchService } from './testing/index.ts'
import { fetchYouTubeVideo } from './youtube-video.ts'

afterEach(() => {
  setDefaultWebFetch(null)
})

const URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=90'

const ANSWER = {
  title: 'Big Buck Bunny',
  author_name: 'Blender',
  author_url: 'https://www.youtube.com/@BlenderOfficial',
  type: 'video',
  height: 113,
  width: 200,
  version: '1.0',
  provider_name: 'YouTube',
  provider_url: 'https://www.youtube.com/',
  thumbnail_height: 360,
  thumbnail_width: 480,
  thumbnail_url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
  html: '<iframe></iframe>',
}

const REQUEST_URL = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(URL) + '&format=json'

function oembedAnswering(answer: string) {
  const webFetch = createTestWebFetchService({ oembed: { [REQUEST_URL]: answer } })
  setDefaultWebFetch(webFetch)
  return webFetch
}

it('asks the oEmbed endpoint and returns the snapshot with the pasted URL', async () => {
  const webFetch = oembedAnswering(JSON.stringify(ANSWER))
  expect(await fetchYouTubeVideo(URL)).toEqual({
    url: URL,
    title: 'Big Buck Bunny',
    author_name: 'Blender',
    author_url: 'https://www.youtube.com/@BlenderOfficial',
    thumbnail_url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    thumbnail_width: 480,
    thumbnail_height: 360,
    width: 200,
    height: 113,
  })
  expect(webFetch.requests()).toEqual([{ kind: 'oembed', url: REQUEST_URL }])
})

it('does not fetch for a URL that is not a YouTube video', async () => {
  const webFetch = oembedAnswering('{}')
  expect(await fetchYouTubeVideo('https://example.com/watch?v=aqz-KE-bpKQ')).toBeNull()
  expect(webFetch.requests()).toEqual([])
})

it('rejects when the fetch fails', async () => {
  const webFetch = oembedAnswering('{}')
  vi.spyOn(webFetch, 'fetchOembed').mockRejectedValue({ kind: 'io', message: 'answered 404' })
  await expect(fetchYouTubeVideo(URL)).rejects.toMatchObject({ kind: 'io' })
})

it('rejects an answer that is not an object', async () => {
  oembedAnswering('null')
  await expect(fetchYouTubeVideo(URL)).rejects.toThrow('invalid oEmbed answer')
})
