import type { ReactElement } from 'react'
import { GitSyncSettingsField } from './git-sync-section.tsx'
import { IcloudSettingsField } from './icloud-section.tsx'
import { SettingsSection } from './section.tsx'

/**
 * Settings → Sync: where this graph syncs. iCloud Drive and a Git repository
 * live together here, and both stay visible so an iCloud-hosted graph can
 * still keep a repository. The GitHub account is under Accounts: it belongs
 * to the machine, not to the graph.
 */
export function SyncSection(): ReactElement {
  return (
    <SettingsSection id="sync">
      <IcloudSettingsField />
      <GitSyncSettingsField />
    </SettingsSection>
  )
}
