import { afterEach, describe, expect, it } from 'vitest'
import { setBridge } from '../ipc/bridge.ts'
import {
  createTestIpcBridgeService,
  createTestSecretStoreService,
  installTestBridge,
} from '../testing/index.ts'
import { deleteSecret, getSecret, setSecret } from './keychain.ts'
import {
  createSecretStoreService,
  defaultSecretStore,
  setDefaultSecretStore,
} from './secret-store-service.ts'

afterEach(() => {
  setDefaultSecretStore(null)
  setBridge(null)
})

describe('createSecretStoreService', () => {
  it('reads, writes and deletes through the secret commands', async () => {
    const ipc = createTestIpcBridgeService({
      commands: {
        secret_get: () => 'value',
        secret_set: () => null,
        secret_delete: () => null,
      },
    })
    const store = createSecretStoreService({ ipc })

    await expect(store.get('a')).resolves.toBe('value')
    await store.set('a', 'b')
    await store.delete('a')

    expect(ipc.calls()).toEqual([
      { command: 'secret_get', args: { name: 'a' } },
      { command: 'secret_set', args: { name: 'a', value: 'b' } },
      { command: 'secret_delete', args: { name: 'a' } },
    ])
  })

  it('reads a missing secret as null', async () => {
    const ipc = createTestIpcBridgeService({ commands: { secret_get: () => null } })
    await expect(createSecretStoreService({ ipc }).get('a')).resolves.toBeNull()
  })

  it('rejects a malformed response with a parse error', async () => {
    const ipc = createTestIpcBridgeService({ commands: { secret_get: () => 42 } })
    await expect(createSecretStoreService({ ipc }).get('a')).rejects.toMatchObject({
      kind: 'parse',
    })
  })

  it('rejects a failed command with its app error', async () => {
    const ipc = createTestIpcBridgeService({
      commands: {
        secret_set: () => {
          throw { kind: 'io', message: 'keychain locked' }
        },
      },
    })
    await expect(createSecretStoreService({ ipc }).set('a', 'b')).rejects.toEqual({
      kind: 'io',
      message: 'keychain locked',
    })
  })
})

describe('defaultSecretStore', () => {
  it('returns the installed service until it is cleared', () => {
    const fake = createTestSecretStoreService()
    setDefaultSecretStore(fake)
    expect(defaultSecretStore()).toBe(fake)

    setDefaultSecretStore(null)
    expect(defaultSecretStore()).not.toBe(fake)
    expect(defaultSecretStore()).toBe(defaultSecretStore())
  })

  it('uses the bridge installed at call time', async () => {
    const store = defaultSecretStore()
    installTestBridge(createTestIpcBridgeService({ commands: { secret_get: () => 'first' } }))
    await expect(store.get('a')).resolves.toBe('first')

    installTestBridge(createTestIpcBridgeService({ commands: { secret_get: () => 'second' } }))
    await expect(store.get('a')).resolves.toBe('second')
  })

  it('backs the keychain functions', async () => {
    const fake = createTestSecretStoreService({ a: '1' })
    setDefaultSecretStore(fake)

    await expect(getSecret('a')).resolves.toBe('1')
    await setSecret('b', '2')
    await deleteSecret('a')

    expect(fake.snapshot()).toEqual({ b: '2' })
  })
})

describe('createTestSecretStoreService', () => {
  it('starts from the initial secrets', async () => {
    const store = createTestSecretStoreService({ a: '1' })
    await expect(store.get('a')).resolves.toBe('1')
    await expect(store.get('missing')).resolves.toBeNull()
  })

  it('replaces and deletes secrets', async () => {
    const store = createTestSecretStoreService({ a: '1' })
    await store.set('a', '2')
    await store.set('b', '3')
    await store.delete('b')
    await store.delete('missing')

    expect(store.snapshot()).toEqual({ a: '2' })
  })

  it('keeps the initial record unchanged', async () => {
    const initial = { a: '1' }
    const store = createTestSecretStoreService(initial)
    await store.set('a', '2')

    expect(initial).toEqual({ a: '1' })
  })
})
