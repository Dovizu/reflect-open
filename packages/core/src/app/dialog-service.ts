/** A file type filter for {@link DialogService.pickFiles}. */
export interface DialogFilter {
  name: string
  extensions: readonly string[]
}

export interface PickFilesOptions {
  multiple: boolean
  title: string
  filters?: readonly DialogFilter[]
}

export interface PickFolderOptions {
  title: string
  /** The folder the picker starts in. */
  defaultPath?: string
}

/** Native open panels. Every method resolves `null` when the user cancels. */
export interface DialogService {
  /** Absolute paths of the picked files. */
  pickFiles(options: PickFilesOptions): Promise<readonly string[] | null>
  /** The absolute path of the picked folder. */
  pickFolder(options: PickFolderOptions): Promise<string | null>
}

let defaultService: DialogService | null = null

/** The process-wide `DialogService`; throws when the host installed none. */
export function defaultDialog(): DialogService {
  if (defaultService === null) {
    throw new Error('No DialogService is installed. Call setDefaultDialog() at startup.')
  }
  return defaultService
}

/** Install the process-wide `DialogService`, or remove it with `null`. */
export function setDefaultDialog(service: DialogService | null): void {
  defaultService = service
}
