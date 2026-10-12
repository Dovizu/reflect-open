import { describe, expect, it } from 'vitest'
import { createTestImageCodec } from './image-codec.ts'

describe('createTestImageCodec', () => {
  it('decodes image blobs as 1x1 and rejects the rest by default', async () => {
    const codec = createTestImageCodec()
    const image = await codec.decode(new Blob(['png'], { type: 'image/png' }))
    expect([image?.width, image?.height]).toEqual([1, 1])
    expect(await codec.decode(new Blob(['text'], { type: 'text/plain' }))).toBeNull()
    expect(codec.decodedFiles()).toHaveLength(1)
  })

  it('records encodes and tracks open images', async () => {
    const file = new Blob(['heic'], { type: 'image/heic' })
    const codec = createTestImageCodec({ size: () => ({ width: 8, height: 4 }) })
    const image = await codec.decode(file)
    expect(codec.openImages()).toBe(1)

    const scaled = await image!.encode({ type: 'image/jpeg', quality: 0.5, width: 2, height: 1 })
    const full = await image!.encode({ type: 'image/png', quality: 1 })
    image!.close()
    image!.close()

    expect(await scaled?.text()).toBe('encoded 2x1')
    expect(scaled?.type).toBe('image/jpeg')
    expect(await full?.text()).toBe('encoded 8x4')
    expect(codec.encodes()).toEqual([
      { file, type: 'image/jpeg', quality: 0.5, width: 2, height: 1 },
      { file, type: 'image/png', quality: 1, width: 8, height: 4 },
    ])
    expect(codec.openImages()).toBe(0)
  })

  it('fails encodes on request', async () => {
    const codec = createTestImageCodec()
    const image = await codec.decode(new Blob(['png'], { type: 'image/png' }))
    codec.failEncodes(true)
    expect(await image!.encode({ type: 'image/jpeg', quality: 1 })).toBeNull()
    codec.failEncodes(false)
    expect(await image!.encode({ type: 'image/jpeg', quality: 1 })).not.toBeNull()
    expect(codec.encodes()).toHaveLength(1)
  })
})
