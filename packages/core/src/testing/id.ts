import { createWebCryptoHashService, type HashService } from '../app/hash-service.ts'
import type { IdService, PkcePair } from '../app/id-service.ts'

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz'

function crockford(value: number, length: number): string {
  let out = ''
  let rest = value
  for (let i = 0; i < length; i++) {
    out = CROCKFORD.charAt(rest % 32) + out
    rest = Math.floor(rest / 32)
  }
  return out
}

/** FNV-1a, so each seed gets its own id space. */
function seedNumber(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193) >>> 0
  }
  return seed === '' ? 0 : hash
}

export interface TestIdService extends IdService {
  /** Every `uuid()` and `noteId()` value, in issue order. */
  issued(): readonly string[]
}

/**
 * Deterministic ids: `uuid()` counts up from `00000000-0000-4000-8000-000000000001`
 * and `noteId()` returns monotonic lowercase ULIDs. A `seed` changes the first
 * UUID group and the ULID timestamp.
 */
export function createTestIdService(options?: { seed?: string }): TestIdService {
  const seed = seedNumber(options?.seed ?? '')
  const uuidPrefix = seed.toString(16).padStart(8, '0')
  const ulidTime = crockford(seed, 10)
  const issued: string[] = []
  let uuidCount = 0
  let noteIdCount = 0
  return {
    uuid: () => {
      uuidCount += 1
      const value = `${uuidPrefix}-0000-4000-8000-${uuidCount.toString(16).padStart(12, '0')}`
      issued.push(value)
      return value
    },
    noteId: () => {
      noteIdCount += 1
      const value = ulidTime + crockford(noteIdCount, 16)
      issued.push(value)
      return value
    },
    pkceChallenge: (): Promise<PkcePair> =>
      Promise.resolve({
        code_verifier: 'test-code-verifier',
        code_challenge: 'test-code-challenge',
      }),
    issued: () => [...issued],
  }
}

export interface TestHashService extends HashService {
  /** Every input passed to `sha256Hex()`, in call order. */
  hashed(): readonly string[]
}

/** The real Web Crypto hash, which is deterministic, plus call recording. */
export function createTestHashService(): TestHashService {
  const inner = createWebCryptoHashService()
  const hashed: string[] = []
  return {
    sha256Hex: async (text) => {
      hashed.push(text)
      return await inner.sha256Hex(text)
    },
    hashed: () => [...hashed],
  }
}
