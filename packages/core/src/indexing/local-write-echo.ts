import { defaultFileChanges, type FileChange } from './file-change-service.ts'

/** `defaultFileChanges().subscribeOwnWrites`, one path per call. */
export function subscribeOwnWrites(handler: (path: string) => void): () => void {
  return defaultFileChanges().subscribeOwnWrites((paths) => {
    for (const path of paths) {
      handler(path)
    }
  })
}

/** `defaultFileChanges().reportOwnWrite`. */
export function echoLocalWrite(change: FileChange): void {
  defaultFileChanges().reportOwnWrite([change])
}
