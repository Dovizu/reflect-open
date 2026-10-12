import { defaultSecretStore } from './secret-store-service.ts'

/** Store `value` in the OS keychain under `name`, replacing any prior value. */
export async function setSecret(name: string, value: string): Promise<void> {
  await defaultSecretStore().set(name, value)
}

/** Read the secret stored under `name`, or `null` when none exists. */
export async function getSecret(name: string): Promise<string | null> {
  return await defaultSecretStore().get(name)
}

/** Remove the secret stored under `name` (a missing entry is not an error). */
export async function deleteSecret(name: string): Promise<void> {
  await defaultSecretStore().delete(name)
}
