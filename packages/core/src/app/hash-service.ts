/**
 * Content hashing.
 */
export interface HashService {
  /**
   * Lowercase hex SHA-256 of the UTF-8 bytes of `text`.
   */
  sha256Hex(text: string): Promise<string>
}

class WebCryptoHashServiceImpl implements HashService {
  async sha256Hex(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
}

export function createWebCryptoHashService(): HashService {
  return new WebCryptoHashServiceImpl()
}
