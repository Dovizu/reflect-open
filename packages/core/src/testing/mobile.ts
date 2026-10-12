import type { OpenDocumentsService } from '../documents/open-documents-service.ts'
import { createKeyboardService, type KeyboardService } from '../mobile/keyboard-service.ts'
import { createShareService, type ShareService } from '../mobile/share-service.ts'
import { createTestOpenDocumentsService } from './documents.ts'

/** The real {@link KeyboardService}, starting at `height` (closed by default). */
export function createTestKeyboardService(options?: { height?: number }): KeyboardService {
  const service = createKeyboardService()
  service.publish(options?.height ?? 0)
  return service
}

/** The real {@link ShareService} over `openDocuments` (a fresh registry by default). */
export function createTestShareService(options?: {
  openDocuments?: Pick<OpenDocumentsService, 'sessionFor'>
}): ShareService {
  return createShareService({
    openDocuments: options?.openDocuments ?? createTestOpenDocumentsService(),
  })
}
