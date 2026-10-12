import type { FileChange, FileChangeSource } from './file-change-service.ts'

export type FileChangeHandler = (changes: FileChange[], source: FileChangeSource) => void
