import { isNotNullish } from '@ocavue/utils'
import { generateText, streamText } from '@reflect/modules/ai'
import { describe, expect, it } from 'vitest'
import type { AiProviderConfig } from '../settings/schema.ts'
import { APP_REVIEW_STUB_KEY, createDemoModel, DEMO_REPLY_TEXT } from './app-review-demo.ts'
import { createTestHttpService, createTestNoteToolsService } from '../testing/index.ts'
import { createChatEngineService, type ChatStreamEvent } from './chat/chat-engine-service.ts'
import { fitToContextWindow } from './chat/context-window.ts'
import {
  createLanguageModelService,
  createLazyAiSdkLoader,
  withAppReviewDemo,
} from './language-model-service.ts'

describe('createDemoModel', () => {
  it('generates the demo reply without any transport', async () => {
    const result = await generateText({
      model: createDemoModel(),
      prompt: 'hello',
      maxRetries: 0,
    })
    expect(result.text).toBe(DEMO_REPLY_TEXT)
  })

  it('streams the demo reply word by word', async () => {
    const result = streamText({
      model: createDemoModel(),
      prompt: 'hello',
      maxRetries: 0,
    })
    let text = ''
    for await (const delta of result.textStream) {
      text += delta
    }
    expect(text).toBe(DEMO_REPLY_TEXT)
  })

  it('carries a full chat turn end to end without fetching', async () => {
    const config: AiProviderConfig = {
      id: 'cfg-demo',
      provider: 'openai',
      model: 'gpt-5.6-sol',
      keyHint: 'demo1',
    }
    const events: ChatStreamEvent[] = []
    // No route answers: any request the demo sent would fail the turn.
    const http = createTestHttpService()
    const engine = createChatEngineService({
      languageModel: withAppReviewDemo(
        createLanguageModelService({ http, sdk: createLazyAiSdkLoader() }),
      ),
      noteTools: createTestNoteToolsService(),
      fitToContextWindow,
    })
    const turn = engine.streamTurn({
      config,
      apiKey: APP_REVIEW_STUB_KEY,
      messages: [{ role: 'user', content: 'What is in my notes?' }],
      today: '2026-08-14',
      semanticSearchEnabled: false,
      customSystemPrompt: '',
      context: null,
    })
    for await (const event of turn) {
      events.push(event)
    }
    const text = events
      .map((event) => (event.type === 'text-delta' ? event.text : null))
      .filter(isNotNullish)
      .join('')
    expect(text).toBe(DEMO_REPLY_TEXT)
    expect(events.at(-1)?.type).toBe('complete')
    expect(http.requests()).toEqual([])
  })
})
