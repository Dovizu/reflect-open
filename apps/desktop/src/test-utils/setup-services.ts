import { beforeEach } from 'vitest'
import { installTestShellServices } from '@reflect/core/testing'
import { createDomLifecycleAdapter } from '@/services/dom-lifecycle.ts'

// Only `@reflect/core/testing`: `vi.mock` cannot replace a module a setup file already loaded.
beforeEach(() => {
  installTestShellServices(
    typeof document === 'undefined' ? {} : { dom: createDomLifecycleAdapter() },
  )
})
