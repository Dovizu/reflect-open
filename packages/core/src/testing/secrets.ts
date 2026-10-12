import type { AppInfoService } from '../app/app-info-service.ts'
import type { SecretStoreService } from '../secrets/secret-store-service.ts'

export interface TestSecretStoreService extends SecretStoreService {
  /** The stored secrets, keyed by name. */
  snapshot(): Record<string, string>
}

/** An in-memory {@link SecretStoreService} seeded with `initial`. */
export function createTestSecretStoreService(
  initial: Record<string, string> = {},
): TestSecretStoreService {
  const secrets = new Map<string, string>(Object.entries(initial))
  return {
    get: async (name) => secrets.get(name) ?? null,
    set: async (name, value) => {
      secrets.set(name, value)
    },
    delete: async (name) => {
      secrets.delete(name)
    },
    snapshot: () => Object.fromEntries(secrets),
  }
}

/** An {@link AppInfoService} that reports `version`. */
export function createTestAppInfoService(version = '0.0.0-test'): AppInfoService {
  return {
    version: async () => version,
  }
}
