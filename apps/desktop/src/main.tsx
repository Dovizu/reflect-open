// Must stay the first import: see `boot.ts`.
import { app, coreServices } from '@/boot.ts'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client.ts'
import { registerAppCommands } from '@/lib/commands/app-commands.ts'
import { installNativeMenu } from '@/lib/native-menu/menu.ts'
import { registerAppKeymaps } from '@/lib/shortcuts.ts'
import { PlatformRoot, warmPlatformRoot } from '@platform-root'
import { EditorFullWidthEffect } from '@/providers/editor-full-width.tsx'
import { EditorTextSizeEffect } from '@/providers/editor-text-size.tsx'
import { ThemeEffect } from '@/providers/theme-provider.tsx'
import { AppServicesProvider, CoreServicesProvider } from '@/services/services-provider.tsx'
import '@/styles/index.css'

// Start the platform root's boot-critical work (on mobile, the
// iCloud-container resolve) now, ahead of React's first render.
warmPlatformRoot()
registerAppCommands(app.commands)
registerAppKeymaps(app.keymap)
installNativeMenu(app.nativeMenu).catch((cause: unknown) => {
  coreServices.logger.error('failed to install the native menu', cause)
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root was not found')
}

const reactRootOptions = app.exceptionTelemetry.reactRootOptions()

// Platform-neutral providers only — everything desktop- or mobile-specific
// (update checks, drag region, graph bootstrap mode) lives inside the
// platform root (Plan 19).
createRoot(rootElement, reactRootOptions).render(
  <StrictMode>
    <CoreServicesProvider services={coreServices}>
      <AppServicesProvider services={app}>
        <QueryClientProvider client={queryClient}>
          <EditorFullWidthEffect />
          <EditorTextSizeEffect />
          <ThemeEffect />
          <PlatformRoot />
        </QueryClientProvider>
      </AppServicesProvider>
    </CoreServicesProvider>
  </StrictMode>,
)
