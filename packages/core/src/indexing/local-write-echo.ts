import { defaultFileChanges, type FileChange } from './file-change-service.ts'

/** `defaultFileChanges().reportOwnWrite`. */
export function echoLocalWrite(change: FileChange): void {
  defaultFileChanges().reportOwnWrite([change])
}
