import type { ReactElement, ReactNode } from 'react'
import type { GraphInfo } from '@reflect/core'
import { useMainWindowEffect } from '@/hooks/use-main-window-effect.ts'
import { useSettings } from '@/providers/settings-provider.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Mounts the asset-description lifecycle for the open graph (Plan 20): has the
 * app-lifetime `AssetDescriptionService` open a session for this graph, whose
 * loop describes new eligible images/PDFs into managed `.reflect.md`
 * descriptions. No UI — the only surface is the Settings backfill button; this
 * provider only handles the automatic path for newly added assets, and only
 * when `describeAssets` is on.
 */

interface AssetDescribeProviderProps {
  graph: GraphInfo
  children: ReactNode
}

export function AssetDescribeProvider({
  graph,
  children,
}: AssetDescribeProviderProps): ReactElement {
  const { assetDescription } = useAppServices()
  const { settings } = useSettings()
  const describeAssets = settings.describeAssets

  // Main window only — two describers would double-bill the same assets.
  useMainWindowEffect(() => {
    if (!describeAssets) {
      return
    }
    const session = assetDescription.openSession({
      generation: graph.generation,
    })
    session.start()
    return () => {
      session.dispose()
    }
  }, [assetDescription, graph.generation, describeAssets])

  return <>{children}</>
}
