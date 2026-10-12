import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultImageCodec } from '@reflect/core'
import { createTestImageCodec, type TestImageCodecService } from '@reflect/core/testing'
import { toPortableImageFile } from './image-file.ts'

function installCodec(options?: Parameters<typeof createTestImageCodec>[0]): TestImageCodecService {
  const codec = createTestImageCodec(options)
  setDefaultImageCodec(codec)
  return codec
}

afterEach(() => {
  setDefaultImageCodec(null)
})

describe('toPortableImageFile', () => {
  it('transcodes a HEIC pick to JPEG', async () => {
    const codec = installCodec({ size: () => ({ width: 4, height: 2 }) })
    const picked = new File(['heic'], 'photo.heic', { type: 'image/heic' })
    const portable = await toPortableImageFile(picked)

    expect(portable.name).toBe('photo.jpg')
    expect(portable.type).toBe('image/jpeg')
    expect(await portable.text()).toBe('encoded 4x2')
    expect(codec.encodes()).toEqual([
      { file: picked, type: 'image/jpeg', quality: 0.92, width: 4, height: 2 },
    ])
    expect(codec.openImages()).toBe(0)
  })

  it('recognizes HEIF by filename when the pick carries no type', async () => {
    installCodec({ size: () => ({ width: 4, height: 2 }) })
    const picked = new File(['heif'], 'IMG_0001.HEIF', { type: '' })
    expect((await toPortableImageFile(picked)).name).toBe('IMG_0001.jpg')
  })

  it('passes every other format through untouched', async () => {
    const codec = installCodec()
    const picked = new File(['png'], 'screenshot.png', { type: 'image/png' })
    expect(await toPortableImageFile(picked)).toBe(picked)
    expect(codec.decodedFiles()).toEqual([])
  })

  it('keeps the original when the webview cannot decode it', async () => {
    installCodec({ size: () => null })
    const picked = new File(['not an image'], 'broken.heic', { type: 'image/heic' })
    expect(await toPortableImageFile(picked)).toBe(picked)
  })

  it('keeps the original when encoding fails', async () => {
    const codec = installCodec()
    codec.failEncodes(true)
    const picked = new File(['heic'], 'photo.heic', { type: 'image/heic' })
    expect(await toPortableImageFile(picked)).toBe(picked)
    expect(codec.openImages()).toBe(0)
  })
})
