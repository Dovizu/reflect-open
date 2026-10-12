import { z } from 'zod'
import { defaultSecretStore, type SecretStoreService } from '../secrets/secret-store-service.ts'
import type { GitCredential } from './git-repository-service.ts'

/**
 * Sign-ins for git hosts other than github.com, one keychain entry per
 * host (`git-host:<host>`): a username and a token presented as HTTPS
 * basic auth. GitHub keeps its own managed credential (`github-auth`);
 * SSH remotes need none (the agent answers).
 */
const hostCredentialSchema = z.object({ username: z.string(), secret: z.string() })

/** The host of an HTTPS remote URL (lowercase, with any port), else `null`. */
export function remoteHost(remoteUrl: string): string | null {
  const match = /^https?:\/\/([^/@]+@)?([^/]+)\//i.exec(
    remoteUrl.endsWith('/') ? remoteUrl : `${remoteUrl}/`,
  )
  return match === null ? null : match[2]!.toLowerCase()
}

function secretName(host: string): string {
  return `git-host:${host.toLowerCase()}`
}

export interface GitHostCredentialService {
  /** The stored sign-in for `host`, or `null` when absent or unreadable. */
  load(host: string): Promise<GitCredential | null>
}

export function createGitHostCredentialService(deps: {
  secretStore: SecretStoreService
}): GitHostCredentialService {
  const { secretStore } = deps
  return {
    async load(host) {
      const raw = await secretStore.get(secretName(host))
      if (raw === null) {
        return null
      }
      try {
        return hostCredentialSchema.parse(JSON.parse(raw))
      } catch {
        return null
      }
    },
  }
}

let installedService: GitHostCredentialService | null = null
let fallback: {
  service: GitHostCredentialService
  secretStore: SecretStoreService
} | null = null

/**
 * The process-wide `GitHostCredentialService`; one over
 * {@link defaultSecretStore} unless {@link setDefaultGitHostCredentials}
 * installed another.
 */
export function defaultGitHostCredentials(): GitHostCredentialService {
  if (installedService !== null) {
    return installedService
  }
  const secretStore = defaultSecretStore()
  if (fallback?.secretStore !== secretStore) {
    fallback = { service: createGitHostCredentialService({ secretStore }), secretStore }
  }
  return fallback.service
}

/** Install the process-wide `GitHostCredentialService`; `null` restores the default-backed one. */
export function setDefaultGitHostCredentials(service: GitHostCredentialService | null): void {
  installedService = service
  fallback = null
}
