import { open } from '@tauri-apps/plugin-dialog'
import type { DialogService } from '@reflect/core'

/**
 * Native open panels through `@tauri-apps/plugin-dialog`.
 */
export function createTauriDialogService(): DialogService {
  return {
    async pickFiles({ multiple, title, filters }) {
      const picked = await open({
        multiple,
        directory: false,
        title,
        ...(filters === undefined
          ? {}
          : {
              filters: filters.map((filter) => ({
                name: filter.name,
                extensions: [...filter.extensions],
              })),
            }),
      })
      if (picked === null) {
        return null
      }
      return Array.isArray(picked) ? picked : [picked]
    },
    async pickFolder({ title, defaultPath }) {
      const picked = await open({
        directory: true,
        multiple: false,
        title,
        ...(defaultPath === undefined ? {} : { defaultPath }),
      })
      return typeof picked === 'string' ? picked : null
    },
  }
}
