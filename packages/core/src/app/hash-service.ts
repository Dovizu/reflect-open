/** Content hashing. */
export interface HashService {
  /** Lowercase hex SHA-256 of the UTF-8 bytes of `text`. */
  sha256Hex(text: string): Promise<string>
}

export function createWebCryptoHashService(): HashService {
  return {
    sha256Hex: async (text) => {
      const bytes = new TextEncoder().encode(text)
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      )
    },
  }
}

let defaultService: HashService | null = null

/** The process-wide `HashService`, the Web Crypto one unless replaced. */
export function defaultHashService(): HashService {
  defaultService ??= createWebCryptoHashService()
  return defaultService
}

/** Replace the process-wide `HashService`; `null` restores the Web Crypto one. */
export function setDefaultHashService(service: HashService | null): void {
  defaultService = service
}
