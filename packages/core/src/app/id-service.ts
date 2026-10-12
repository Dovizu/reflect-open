import pkceChallenge from 'pkce-challenge'
import { ulid } from 'ulidx'

/** A PKCE verifier and its S256 challenge, in the shape `pkce-challenge` returns. */
export interface PkcePair {
  code_verifier: string
  code_challenge: string
}

/** Fresh random identifiers. */
export interface IdService {
  /** A random RFC 4122 version 4 UUID. */
  uuid(): string
  /** A fresh note `id`: a lowercase Crockford base32 ULID. */
  noteId(): string
  /** A fresh PKCE pair for an OAuth authorization code flow. */
  pkceChallenge(): Promise<PkcePair>
}

export function createSystemIdService(): IdService {
  return {
    uuid: () => crypto.randomUUID(),
    noteId: () => ulid().toLowerCase(),
    pkceChallenge: async () => {
      const { code_verifier, code_challenge } = await pkceChallenge()
      return { code_verifier, code_challenge }
    },
  }
}

let defaultService: IdService | null = null

/** The process-wide `IdService`, the system one unless replaced. */
export function defaultIdService(): IdService {
  defaultService ??= createSystemIdService()
  return defaultService
}

/** Replace the process-wide `IdService`; `null` restores the system one. */
export function setDefaultIdService(service: IdService | null): void {
  defaultService = service
}
