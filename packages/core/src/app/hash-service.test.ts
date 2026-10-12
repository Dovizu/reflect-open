import { describe, expect, it } from 'vitest'
import { createWebCryptoHashService } from './hash-service.ts'
describe('createWebCryptoHashService', () => {
  it('returns lowercase hex SHA-256', async () => {
    const hash = createWebCryptoHashService()
    await expect(hash.sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    await expect(hash.sha256Hex('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('is deterministic, content-sensitive, and hex-encoded', async () => {
    const hash = createWebCryptoHashService()
    const helloHash = await hash.sha256Hex('hello')
    expect(helloHash).toBe(await hash.sha256Hex('hello'))
    expect(helloHash).not.toBe(await hash.sha256Hex('hello!'))
    expect(helloHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes UTF-8 bytes', async () => {
    await expect(createWebCryptoHashService().sha256Hex('\u{E9}')).resolves.toBe(
      '4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c',
    )
  })
})
