import { defaultPlatform, hasBridge, setBridge } from '@reflect/core'

import { createDevBridge } from '@/dev/dev-bridge.ts'
import { createDevFileStore } from '@/dev/dev-file-store.ts'
import { createDevIndexDb } from '@/dev/dev-index-db.ts'
import { seedGraphFiles } from '@/dev/seed-graph.ts'

const { appPlatform } = defaultPlatform()

if (!hasBridge()) {
  const index = await createDevIndexDb()
  const files = createDevFileStore(seedGraphFiles())
  const devBridge = createDevBridge({ files, index })
  setBridge(devBridge)
}

const { PlatformRoot, warmPlatformRoot } = await (async () => {
  if (appPlatform === 'desktop') {
    const { warmPlatformRoot, PlatformRoot } = await import('@/platform-root.desktop.tsx')
    return { PlatformRoot, warmPlatformRoot }
  } else {
    const { warmPlatformRoot, PlatformRoot } = await import('@/platform-root.mobile.tsx')
    return { PlatformRoot, warmPlatformRoot }
  }
})()

export { PlatformRoot, warmPlatformRoot }
