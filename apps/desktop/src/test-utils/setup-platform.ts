import { beforeEach } from 'vitest'
import { createPlatformService, setDefaultPlatform } from '@reflect/core/platform-service'
import { detectPlatformFacts } from '@/services/detect-platform.ts'

// Nothing here loads the `@reflect/core` barrel or `@tauri-apps/*`, so test files can still mock them.
function installDetectedPlatform(): void {
  setDefaultPlatform(createPlatformService(detectPlatformFacts(false)))
}

installDetectedPlatform()
beforeEach(installDetectedPlatform)
