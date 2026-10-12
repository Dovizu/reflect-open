import { MockLanguageModelV3 } from '@reflect/modules/ai/test'
import type { LanguageModel } from '@reflect/modules/ai'
import { afterEach, describe, expect, it } from 'vitest'
import { cloudSafeSelection } from '../privacy/checkers.ts'
import { createTestLanguageModelService } from '../testing/index.ts'
import { setDefaultLanguageModel } from './language-model-service.ts'
import { transformSelection, type TransformSelectionOptions } from './transform-selection.ts'

afterEach(() => {
  setDefaultLanguageModel(null)
})

const options: TransformSelectionOptions = {
  config: { id: 'cfg', provider: 'openai', model: 'gpt-5.5', keyHint: 'test' },
  apiKey: 'sk-test',
  fetchFn: globalThis.fetch,
  promptBody: 'Fix {{selectedText}}',
  selection: cloudSafeSelection({ path: 'notes/public.md', isPrivate: false }, 'teh text'),
}

describe('selection model loading', () => {
  it('does not call the provider after aborting during model loading', async () => {
    const controller = new AbortController()
    const loading = Promise.withResolvers<LanguageModel>()
    setDefaultLanguageModel(createTestLanguageModelService(() => loading.promise))
    const model = new MockLanguageModelV3()
    const next = transformSelection({ ...options, signal: controller.signal }).next()
    controller.abort()
    loading.resolve(model)

    expect(await next).toEqual({ done: false, value: { type: 'aborted' } })
    expect(model.doStreamCalls).toHaveLength(0)
  })

  it('returns a terminal error event when the model chunk fails to load', async () => {
    setDefaultLanguageModel(
      createTestLanguageModelService(() => Promise.reject(new Error('model chunk unavailable'))),
    )
    const stream = transformSelection(options)

    expect(await stream.next()).toEqual({
      done: false,
      value: { type: 'error', message: 'model chunk unavailable' },
    })
    expect(await stream.next()).toEqual({ done: true, value: undefined })
  })
})
