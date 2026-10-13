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

/**
 * FNV-1a, so each seed gets its own id space.
 */
function seedNumber(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193) >>> 0
  }
  return seed === '' ? 0 : hash
}

export interface TestIdService extends IdService {
  /**
   * Every `uuid()` and `noteId()` value, in issue order.
   */
  issued(): readonly string[]
}

class TestIdServiceImpl implements TestIdService {
  readonly #uuidPrefix: string
  readonly #ulidTime: string
  readonly #issued: string[] = []
  #uuidCount = 0
  #noteIdCount = 0

  constructor(seed: number) {
    this.#uuidPrefix = seed.toString(16).padStart(8, '0')
    this.#ulidTime = crockford(seed, 10)
  }

  uuid(): string {
    this.#uuidCount += 1
    const value = `${this.#uuidPrefix}-0000-4000-8000-${this.#uuidCount.toString(16).padStart(12, '0')}`
    this.#issued.push(value)
    return value
  }

  noteId(): string {
    this.#noteIdCount += 1
    const value = this.#ulidTime + crockford(this.#noteIdCount, 16)
    this.#issued.push(value)
    return value
  }

  pkceChallenge(): Promise<PkcePair> {
    return Promise.resolve({
      code_verifier: 'test-code-verifier',
      code_challenge: 'test-code-challenge',
    })
  }

  issued(): readonly string[] {
    return [...this.#issued]
  }
}

/**
 * Deterministic ids: `uuid()` counts up from `00000000-0000-4000-8000-000000000001`
 * and `noteId()` returns monotonic lowercase ULIDs. A `seed` changes the first
 * UUID group and the ULID timestamp.
 */
export function createTestIdService(options?: { seed?: string }): TestIdService {
  return new TestIdServiceImpl(seedNumber(options?.seed ?? ''))
}

export interface TestHashService extends HashService {
  /**
   * Every input passed to `sha256Hex()`, in call order.
   */
  hashed(): readonly string[]
}

/**
 * Forwards to the real Web Crypto hash and records each input.
 */
class TestHashServiceImpl implements TestHashService {
  readonly #inner: HashService = createWebCryptoHashService()
  readonly #hashed: string[] = []

  async sha256Hex(text: string): Promise<string> {
    this.#hashed.push(text)
    return await this.#inner.sha256Hex(text)
  }

  hashed(): readonly string[] {
    // FIXME: is TestHashService.hashed() ever called? If not, remove createTestHashService and TestHashServiceImpl and TestHashService. Furthermore, do we need every createTestXXXService()? is we can just re-use the real services in tests, we should do that instead of creating test versions that provide no additional value.
    return [...this.#hashed]
  }
}

/**
 * The real Web Crypto hash, which is deterministic, plus call recording.
 */
export function createTestHashService(): TestHashService {
  return new TestHashServiceImpl()
}
