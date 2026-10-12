import { afterEach, expect, it } from 'vitest'
import { setDefaultEmbedMedia } from '@reflect/core'
import { createTestEmbedMediaService, createTestLoggerService } from '@reflect/core/testing'
import { resolveYouTubeVideo } from './youtube-video-resolver.ts'

afterEach(() => {
  setDefaultEmbedMedia(null)
})

const URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'

const VIDEO = {
  url: URL,
  title: 'Big Buck Bunny',
  author_name: 'Blender',
  author_url: 'https://www.youtube.com/@BlenderOfficial',
  thumbnail_url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
  thumbnail_width: 480,
  thumbnail_height: 360,
  width: 200,
  height: 113,
}

const { url: _url, ...ANSWER } = VIDEO

/** Install a service whose oEmbed endpoint gives each of `answers` in turn; an `Error` rejects. */
function install(...answers: (string | null | Error)[]) {
  const requests: string[] = []
  const logger = createTestLoggerService()
  setDefaultEmbedMedia(
    createTestEmbedMediaService({
      webFetch: {
        async fetchOembed(url) {
          requests.push(url)
          const answer = answers.shift() ?? null
          if (answer instanceof Error) {
            throw answer
          }
          return JSON.stringify(answer === null ? null : { ...ANSWER, title: answer })
        },
      },
      logger,
    }),
  )
  return { requests, logger }
}

it('returns a fetched video synchronously the second time', async () => {
  const { requests } = install(VIDEO.title)
  const first = resolveYouTubeVideo(URL)
  expect(first).toBeInstanceOf(Promise)
  expect(await first).toEqual(VIDEO)
  expect(resolveYouTubeVideo(URL)).toEqual(VIDEO)
  expect(requests).toHaveLength(1)
})

it('logs a failed fetch and asks again', async () => {
  const cause = new Error('offline')
  const { logger } = install(cause, VIDEO.title)
  expect(await resolveYouTubeVideo(URL)).toBeUndefined()
  expect(logger.getErrors()).toEqual([{ message: `YouTube video fetch failed: ${URL}`, cause }])
  expect(await resolveYouTubeVideo(URL)).toEqual(VIDEO)
})
