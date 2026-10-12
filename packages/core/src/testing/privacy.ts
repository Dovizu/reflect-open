import type { NoteFileService } from '../graph/note-file-service.ts'
import { createPrivacyService, type PrivacyService } from '../privacy/privacy-service.ts'
import { createTestNoteFileService } from './graph.ts'

export interface TestPrivacyServiceOptions {
  /** The notes the live probe reads; defaults to an empty test note file service. */
  noteFile?: Pick<NoteFileService, 'read'>
}

export interface TestPrivacyService extends PrivacyService {
  /** Every path the live privacy probe read, in order. */
  probes(): readonly string[]
}

/** The real {@link PrivacyService} over a test note file service, recording each live probe. */
export function createTestPrivacyService(options?: TestPrivacyServiceOptions): TestPrivacyService {
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  const probeLog: string[] = []
  const service = createPrivacyService({
    noteFile: {
      async read(path, generation) {
        probeLog.push(path)
        return await noteFile.read(path, generation)
      },
    },
  })
  return { ...service, probes: () => [...probeLog] }
}
