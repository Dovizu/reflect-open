import { describe, expect, it } from 'vitest'
import { createTestSecretStoreService } from '../testing/index.ts'
import { createGitHostCredentialService, remoteHost } from './git-host-credential-service.ts'

describe('remoteHost', () => {
  it('names the host of an HTTPS remote, lowercase, with its port', () => {
    expect(remoteHost('https://GitLab.com/alex/notes.git')).toBe('gitlab.com')
    expect(remoteHost('https://git.example.org:8443/team/notes')).toBe('git.example.org:8443')
    expect(remoteHost('http://alex@gitea.local/notes.git')).toBe('gitea.local')
  })

  it('is null for ssh and path remotes', () => {
    expect(remoteHost('git@gitlab.com:alex/notes.git')).toBeNull()
    expect(remoteHost('ssh://git@gitlab.com/alex/notes.git')).toBeNull()
    expect(remoteHost('/Volumes/NAS/notes.git')).toBeNull()
  })
})

describe('GitHostCredentialService', () => {
  it('loads the entry of a host, whatever the case of its name', async () => {
    const secretStore = createTestSecretStoreService({
      'git-host:gitlab.com': JSON.stringify({ username: 'alex', secret: 'glpat' }),
    })
    const credentials = createGitHostCredentialService({ secretStore })
    expect(await credentials.load('GitLab.com')).toEqual({ username: 'alex', secret: 'glpat' })
    expect(await credentials.load('gitea.local')).toBeNull()
  })

  it('treats an unreadable entry as absent', async () => {
    const secretStore = createTestSecretStoreService({ 'git-host:gitea.local': 'not json' })
    const credentials = createGitHostCredentialService({ secretStore })
    expect(await credentials.load('gitea.local')).toBeNull()
  })
})
