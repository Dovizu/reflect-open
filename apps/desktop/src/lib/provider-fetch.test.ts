import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultHttp } from '@reflect/core'
import { createTestHttpService } from '@reflect/core/testing'
import { providerFetch } from './provider-fetch.ts'

afterEach(() => {
  setDefaultHttp(null)
})

describe('providerFetch', () => {
  it('sends the request through the default HTTP service', async () => {
    const http = createTestHttpService([
      { method: 'GET', url: 'https://api.anthropic.com/v1/models', reply: { status: 200 } },
    ])
    setDefaultHttp(http)

    const response = await providerFetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': 'sk-ant-test' },
    })

    expect(response.status).toBe(200)
    const [request] = http.requests()
    expect(request?.url).toBe('https://api.anthropic.com/v1/models')
    expect(request?.headers.get('x-api-key')).toBe('sk-ant-test')
  })

  it('reads the default HTTP service at call time', async () => {
    const first = createTestHttpService()
    const second = createTestHttpService()
    setDefaultHttp(first)
    await providerFetch('https://api.openai.com/v1/models')
    setDefaultHttp(second)
    await providerFetch('https://api.openai.com/v1/models')

    expect(first.requests()).toHaveLength(1)
    expect(second.requests()).toHaveLength(1)
  })
})
