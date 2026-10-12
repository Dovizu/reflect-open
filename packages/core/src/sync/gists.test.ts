import { describe, expect, it } from 'vitest'
import { createTestHttpService, type TestHttpReply } from '../testing/index.ts'
import { createGist, deleteGist, updateGist } from './gists.ts'

const GIST = { id: 'g1', html_url: 'https://gist.github.com/alex/g1' }

function github(reply: TestHttpReply) {
  return createTestHttpService([{ method: '*', url: () => true, reply }])
}

describe('createGist', () => {
  it('posts a secret single-file gist and returns its id and url', async () => {
    const http = github({ status: 201, json: GIST })
    const published = await createGist('tok', { name: 'A.md', content: '# A\n' }, http.fetchFn)

    expect(published).toEqual({ id: 'g1', htmlUrl: 'https://gist.github.com/alex/g1' })
    const [request] = http.requests()
    expect(request?.url).toBe('https://api.github.com/gists')
    expect(request?.method).toBe('POST')
    expect(request?.headers.get('Authorization')).toBe('Bearer tok')
    expect(JSON.parse(request?.body ?? '')).toEqual({
      public: false,
      files: { 'A.md': { content: '# A\n' } },
    })
  })

  it('maps 404 to a reconnect-and-grant auth error (missing gist permission)', async () => {
    const http = github({ status: 404, json: { message: 'Not Found' } })
    await expect(
      createGist('tok', { name: 'A.md', content: 'x' }, http.fetchFn),
    ).rejects.toMatchObject({
      kind: 'auth',
      message: expect.stringMatching(/reconnect/i),
    })
  })

  it('maps 401 to a rejected-token auth error', async () => {
    const http = github({ status: 401, json: { message: 'Bad credentials' } })
    await expect(
      createGist('tok', { name: 'A.md', content: 'x' }, http.fetchFn),
    ).rejects.toMatchObject({ kind: 'auth' })
  })

  it('surfaces other failures with the response body', async () => {
    const http = github(new Response('Validation Failed', { status: 422 }))
    await expect(
      createGist('tok', { name: 'A.md', content: 'x' }, http.fetchFn),
    ).rejects.toMatchObject({
      kind: 'io',
      message: expect.stringContaining('422'),
    })
  })
})

describe('updateGist', () => {
  it('patches the file under its previous name, renaming to the current one', async () => {
    const http = github({ status: 200, json: GIST })
    const published = await updateGist(
      'tok',
      'g1',
      'Old Title.md',
      { name: 'New Title.md', content: 'body' },
      http.fetchFn,
    )

    expect(published).toEqual({ id: 'g1', htmlUrl: 'https://gist.github.com/alex/g1' })
    const [request] = http.requests()
    expect(request?.url).toBe('https://api.github.com/gists/g1')
    expect(request?.method).toBe('PATCH')
    expect(JSON.parse(request?.body ?? '')).toEqual({
      files: { 'Old Title.md': { filename: 'New Title.md', content: 'body' } },
    })
  })

  it('returns null on 404 — the gist is gone and the caller re-creates', async () => {
    const http = github({ status: 404, json: { message: 'Not Found' } })
    await expect(
      updateGist('tok', 'g1', 'A.md', { name: 'A.md', content: 'x' }, http.fetchFn),
    ).resolves.toBeNull()
  })

  it('maps 403 to an auth error', async () => {
    const http = github({ status: 403, json: { message: 'Forbidden' } })
    await expect(
      updateGist('tok', 'g1', 'A.md', { name: 'A.md', content: 'x' }, http.fetchFn),
    ).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('deleteGist', () => {
  it('issues the DELETE and resolves on success', async () => {
    const http = github({ status: 204 })
    await expect(deleteGist('tok', 'g1', http.fetchFn)).resolves.toBeUndefined()
    const [request] = http.requests()
    expect(request?.url).toBe('https://api.github.com/gists/g1')
    expect(request?.method).toBe('DELETE')
  })

  it('treats 404 as success — already gone is the goal state', async () => {
    const http = github({ status: 404, json: { message: 'Not Found' } })
    await expect(deleteGist('tok', 'g1', http.fetchFn)).resolves.toBeUndefined()
  })

  it('maps 401/403 to auth errors', async () => {
    const http = github({ status: 403, json: { message: 'Forbidden' } })
    await expect(deleteGist('tok', 'g1', http.fetchFn)).rejects.toMatchObject({ kind: 'auth' })
  })
})
