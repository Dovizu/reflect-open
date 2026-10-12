import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultImageCodec } from '@reflect/core'
import {
  createTestImageCodec,
  type TestImageCodecService,
  type TestImageSize,
} from '@reflect/core/testing'
import { toChatAttachment } from '@/lib/chat-attachments.ts'

/**
 * The downscale gate: oversized or non-provider-safe images re-encode to a
 * bounded JPEG, small safe ones pass through untouched, and an undecodable
 * file falls back to its original bytes.
 */

function installCodec(size: TestImageSize | null): TestImageCodecService {
  const codec = createTestImageCodec({ size: () => size })
  setDefaultImageCodec(codec)
  return codec
}

function imageFile(type: string): File {
  return new File([new Uint8Array([0x89, 0x50])], 'photo', { type })
}

afterEach(() => {
  setDefaultImageCodec(null)
})

describe('toChatAttachment', () => {
  it('re-encodes an oversized image to a JPEG within the long-edge cap', async () => {
    const codec = installCodec({ width: 4000, height: 2000 })

    const attachment = await toChatAttachment(imageFile('image/jpeg'))

    expect(attachment.mediaType).toBe('image/jpeg')
    expect(attachment.dataUrl).toBe(`data:image/jpeg;base64,${btoa('encoded 1568x784')}`)
    // 4000×2000 scaled by 1568/4000 → 1568×784.
    expect(codec.encodes()).toMatchObject([
      { type: 'image/jpeg', quality: 0.85, width: 1568, height: 784 },
    ])
    expect(codec.openImages()).toBe(0)
  })

  it('passes a small provider-safe image through with its original bytes', async () => {
    const codec = installCodec({ width: 100, height: 50 })

    const attachment = await toChatAttachment(imageFile('image/png'))

    expect(attachment.mediaType).toBe('image/png')
    expect(attachment.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(codec.encodes()).toEqual([])
    expect(codec.openImages()).toBe(0)
  })

  it('transcodes a small non-provider-safe format (HEIC) to JPEG', async () => {
    const codec = installCodec({ width: 100, height: 50 })

    const attachment = await toChatAttachment(imageFile('image/heic'))

    expect(attachment.mediaType).toBe('image/jpeg')
    expect(codec.encodes()).toMatchObject([{ width: 100, height: 50 }])
  })

  it('falls back to the original bytes when the file cannot be decoded', async () => {
    installCodec(null)

    const attachment = await toChatAttachment(imageFile('image/tiff'))

    expect(attachment.mediaType).toBe('image/tiff')
    expect(attachment.dataUrl.startsWith('data:image/tiff;base64,')).toBe(true)
  })
})
