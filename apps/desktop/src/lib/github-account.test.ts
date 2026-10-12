import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setBridge, setDefaultHttp, setDefaultPlatform } from '@reflect/core'
import {
  createTestHttpService,
  createTestPlatformService,
  type TestHttpService,
} from '@reflect/core/testing'
import { fetchSignedInUser } from './github-account.ts'

const USER_URL = 'https://api.github.com/user'
let http: TestHttpService

beforeEach(() => {
  setDefaultPlatform(
    createTestPlatformService({ isMacosDesktop: false, hasMacosTitleBarOverlay: false }),
  )
  http = createTestHttpService()
  setDefaultHttp(http)
})

afterEach(() => {
  setDefaultPlatform(null)
  setDefaultHttp(null)
})

function fakeKeychain(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(initial))
  setBridge({
    invoke: async (command, args) => {
      const name = args['name'] as string
      if (command === 'secret_get') {
        return store.get(name) ?? null
      }
      if (command === 'secret_set') {
        store.set(name, args['value'] as string)
        return null
      }
      if (command === 'secret_delete') {
        store.delete(name)
        return null
      }
      throw new Error(`unexpected command ${command}`)
    },
    listen: async () => () => {},
  })
  return store
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  setBridge(null)
})

describe('fetchSignedInUser', () => {
  it('resolves the stored credential to the signed-in identity', async () => {
    fakeKeychain({ 'github-auth': JSON.stringify({ kind: 'pat', token: 'ghp_abc' }) })
    http.on('GET', USER_URL, jsonResponse({ login: 'alex' }))

    expect(await fetchSignedInUser()).toEqual({ login: 'alex', avatarUrl: null })
  })

  it('returns null without network when nothing is stored', async () => {
    fakeKeychain()

    expect(await fetchSignedInUser()).toBeNull()
    expect(http.requests()).toHaveLength(0)
  })

  it('clears a credential GitHub rejects before rethrowing', async () => {
    const store = fakeKeychain({
      'github-auth': JSON.stringify({ kind: 'pat', token: 'ghp_dead' }),
    })
    http.on('GET', USER_URL, jsonResponse({ message: 'Bad credentials' }, 401))

    await expect(fetchSignedInUser()).rejects.toMatchObject({ kind: 'auth' })
    expect(store.has('github-auth')).toBe(false)
  })

  it('keeps a newer credential saved while a stale lookup was in flight', async () => {
    // The auth step probes the stored credential on mount; if the user saves
    // a fresh token before that probe's rejection lands, clearing must not
    // wipe the new credential — only the token GitHub actually rejected.
    const store = fakeKeychain({
      'github-auth': JSON.stringify({ kind: 'pat', token: 'ghp_old' }),
    })
    http.on('GET', USER_URL, () => {
      store.set('github-auth', JSON.stringify({ kind: 'pat', token: 'ghp_new' }))
      return jsonResponse({ message: 'Bad credentials' }, 401)
    })

    await expect(fetchSignedInUser()).rejects.toMatchObject({ kind: 'auth' })
    expect(JSON.parse(store.get('github-auth') ?? '{}')).toEqual({
      kind: 'pat',
      token: 'ghp_new',
    })
  })
})
