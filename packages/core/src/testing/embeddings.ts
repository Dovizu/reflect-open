import {
  createEmbeddingRuntimeService,
  type EmbeddingRuntimeService,
  type EmbedStatus,
} from '../embeddings/embedding-runtime-service.ts'
import { ReflectError } from '../errors.ts'
import { createTestIpcBridgeService } from './ipc.ts'
import { createTestLoggerService } from './logger.ts'

export interface TestEmbeddingRuntimeServiceOptions {
  /** The runtime status. Defaults to `ready` with model `all-MiniLM-L6-v2`. */
  status?: EmbedStatus
  /** The vector for one text. Defaults to a 384-dim unit vector. */
  vectors?: (text: string) => number[]
}

export interface TestEmbeddingRuntimeService extends EmbeddingRuntimeService {
  /** Change the runtime status and emit it as a status event. */
  setStatus(status: EmbedStatus): void
  /** The `texts` of every `embedTexts` call, in order. */
  embedCalls(): readonly (readonly string[])[]
  /** How many times `ensure` ran. */
  ensureCalls(): number
}

const DIMENSIONS = 384

function unitVector(): number[] {
  const vector = Array.from({ length: DIMENSIONS }, () => 0)
  vector[0] = 1
  return vector
}

/**
 * The real {@link EmbeddingRuntimeService} over a scripted runtime. `ensure`
 * answers the current status without loading anything: drive loads with
 * `setStatus`. `embedTexts` rejects unless the status is `ready`, like the
 * native runtime.
 */
export function createTestEmbeddingRuntimeService(
  options?: TestEmbeddingRuntimeServiceOptions,
): TestEmbeddingRuntimeService {
  let status: EmbedStatus = options?.status ?? { status: 'ready', model: 'all-MiniLM-L6-v2' }
  const vectors = options?.vectors ?? unitVector
  const embedded: string[][] = []
  let ensures = 0

  const ipc = createTestIpcBridgeService({
    commands: {
      embed_status: () => status,
      embed_ensure: () => {
        ensures++
        return status
      },
      embed_texts: (args) => {
        if (status.status !== 'ready') {
          throw new ReflectError('unknown', `embedding model is ${status.status}`)
        }
        const texts = Array.isArray(args['texts']) ? args['texts'].map(String) : []
        embedded.push(texts)
        return texts.map((text) => vectors(text))
      },
    },
  })
  const service = createEmbeddingRuntimeService({ ipc, logger: createTestLoggerService() })

  return {
    ...service,
    setStatus(next) {
      status = next
      ipc.emit('embed:status', next)
    },
    embedCalls: () => embedded.map((texts) => [...texts]),
    ensureCalls: () => ensures,
  }
}
