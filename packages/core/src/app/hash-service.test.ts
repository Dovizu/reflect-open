import { afterEach, describe, expect, it } from 'vitest'
import { hashContent } from '../indexing/hash.ts'
import { createTestHashService } from '../testing/index.ts'
import {
  createWebCryptoHashService,
  defaultHashService,
  setDefaultHashService,
} from './hash-service.ts'

afterEach(() => {
  setDefaultHashService(null)
})

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

  it('hashes UTF-8 bytes', async () => {
    await expect(createWebCryptoHashService().sha256Hex('\u{E9}')).resolves.toBe(
      '4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c',
    )
  })
})

describe('hashContent', () => {
  it('keeps its output format', async () => {
    await expect(hashContent('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('matches the default hash service', async () => {
    const text = '# Title\n\nBody with ünïcode\n'
    await expect(hashContent(text)).resolves.toBe(await defaultHashService().sha256Hex(text))
  })

  it('follows a replaced default', async () => {
    const fake = createTestHashService()
    setDefaultHashService(fake)
    await hashContent('x')
    expect(fake.hashed()).toEqual(['x'])
  })
})
