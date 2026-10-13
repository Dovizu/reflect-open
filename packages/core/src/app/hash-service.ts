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
  } // FIXME: 这个东西真的有必要成为一个 service 吗？我感觉好像我们并不需要在中途替代它，我们能不能直接把它做成一个很简单很简单的函数，然后放到 packages/utils 里面？ 发散一下，统计下所有的 service，看看有没有哪些 service 其实并没有必要抽象成一个 service。如果有的话，请把它们全都放到更合适的位置，以更合适的代码组织方式去修改它们。我怀疑类似的情况包含 pkceChallenge 。但是请深入调查整个代码库，看看是否有其他类似的 service 也可以被简化。
}

export function createWebCryptoHashService(): HashService {
  return new WebCryptoHashServiceImpl()
}
