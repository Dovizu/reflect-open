import type { ReactElement } from 'react'
import type { AppPlatform } from '@reflect/core'
import { Toaster } from '@/components/ui/toast.tsx'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { setPlatformSurface } from '@/lib/platform-surface.ts'
import { MobileApp } from '@/mobile/mobile-app.tsx'
import { GraphProvider } from '@/providers/graph-provider.tsx'

// Editors apply iOS text-input hygiene and shared components render their
// mobile variants — see `platform-surface.ts`. Module scope, because
// it must precede the first editor mount and the first write. It
// replaces the default platform, which `boot.ts` installs before this runs.
setPlatformSurface({ touchEditor: true, mobileApp: true })

/**
 * The mobile surface tree (Plan 19): the shared graph provider in its
 * fixed-root bootstrap (no chooser, no recents reopen) under the mobile app
 * shell. Desktop-only providers (auto-update, drag region) never load here.
 */
export function MobileRoot({ platform }: { platform: AppPlatform }): ReactElement {
  return (
    <GraphProvider platform={platform}>
      <TooltipProvider>
        <MobileApp />
        <Toaster position="top-center" />
      </TooltipProvider>
    </GraphProvider>
  )
}
