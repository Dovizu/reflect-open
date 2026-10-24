import { redactRemoteUrl, type GitRemote } from '@reflect/core'

/**
 * The words the Git repository surfaces use. When the repository is the
 * primary channel, the graph syncs through it, so it speaks of sync. On an
 * iCloud-hosted graph iCloud carries the notes and the repository only keeps
 * a history, so it speaks of backup.
 */
export interface GitSyncWording {
  description: string
  idle: string
  /** Precedes the countdown: "Syncs in 2 minutes". */
  waiting: string
  syncing: string
  now: string
  stop: string
  failed: string
}

const SYNC: GitSyncWording = {
  description: 'Syncs this graph with your other devices and keeps its history.',
  idle: 'Up to date',
  waiting: 'Syncs in',
  syncing: 'Syncing…',
  now: 'Sync now',
  stop: 'Stop syncing',
  failed: 'Sync failed',
}

const BACKUP: GitSyncWording = {
  description:
    'iCloud syncs your notes. This repository keeps a history and updates five minutes after edits go quiet.',
  idle: 'Backed up',
  waiting: 'Backs up in',
  syncing: 'Backing up…',
  now: 'Back up now',
  stop: 'Stop backing up',
  failed: 'Backup failed',
}

export function gitSyncWording(isPrimaryChannel: boolean): GitSyncWording {
  return isPrimaryChannel ? SYNC : BACKUP
}

/**
 * How a surface names the connected remote: `alex/notes on GitHub`,
 * `gitlab.com/alex/notes`, or the URL for SSH and path remotes. A sign-in
 * written into the URL never shows.
 */
export function remoteLabel(remote: GitRemote, remoteUrl: string): string {
  switch (remote.kind) {
    case 'github':
      return `${remote.repo.owner}/${remote.repo.name} on GitHub`
    case 'https':
      return redactRemoteUrl(remoteUrl)
        .replace(/^https?:\/\//i, '')
        .replace(/\.git$/, '')
    case 'ssh':
    case 'path':
      return redactRemoteUrl(remoteUrl)
  }
}
