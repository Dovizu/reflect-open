import type { ReactElement } from 'react'
import type { GraphInfo } from '@reflect/core'
import { WorkspaceContent } from '@/components/workspace-content.tsx'
import { WorkspaceProviders } from '@/components/workspace-providers.tsx'
import { MobileFormattingToolbar } from '@/mobile/formatting-toolbar.tsx'
import { SafeAreaBoundary } from '@/mobile/safe-area-boundary.tsx'
import { useKeyboardVisible } from '@/mobile/use-keyboard.ts'
import { SidebarWidthEffect } from '@/providers/sidebar-width.tsx'
import { UpdateProvider } from '@/providers/update-provider.tsx'

interface TabletWorkspaceProps {
  graph: GraphInfo
}

/**
 * The desktop workspace in a regular-width iPad window: the sidebars, the
 * ⌘K palette, settings and every shortcut, under the iOS app's own services
 * (onboarding, the paywall, native recording, background flushes), which
 * {@link MobileApp} keeps mounted around it.
 *
 * The frame stays inside the safe area and ends at the software keyboard's
 * top edge, like the phone shell: the webview is pinned (Plan 19, decision 8),
 * so the page itself must make room. With the keyboard up the formatting
 * toolbar rides its edge, giving touch typing the list and outline controls
 * a hardware keyboard reaches through shortcuts. Updates come from the App
 * Store, so the update provider is only there for the settings page to read
 * (`supported` is false on iOS).
 */
export function TabletWorkspace({ graph }: TabletWorkspaceProps): ReactElement {
  const keyboardVisible = useKeyboardVisible()
  return (
    <UpdateProvider>
      <SidebarWidthEffect />
      <SafeAreaBoundary>
        <div className="flex h-dvh w-screen flex-col bg-surface-app pt-safe pb-above-keyboard px-safe">
          <WorkspaceProviders graph={graph}>
            {/* The workspace's frame fills this box instead of the viewport. */}
            <div className="min-h-0 flex-1 [--app-shell-height:100%] [--app-shell-width:100%]">
              <WorkspaceContent graph={graph} />
            </div>
          </WorkspaceProviders>
          {keyboardVisible ? <MobileFormattingToolbar /> : null}
        </div>
      </SafeAreaBoundary>
    </UpdateProvider>
  )
}
