import type { XPost } from '@post-embed/types'
import type { LinkPreviewHtml, WebFetchService } from '../app/web-fetch-service.ts'
import { ReflectError } from '../errors.ts'
import type { CaptureInboxService } from '../graph/capture-inbox-service.ts'
import type { ArchivedXPost, ResolvedArchivedPost, XArchiveService } from '../x-archive.ts'

const INBOX_DIR = '.reflect/inbox'

function notFound(what: string): ReflectError {
  return new ReflectError('notFound', `${what} not found`)
}

export interface TestCaptureInboxService extends CaptureInboxService {
  /** Put a file into the inbox. Non-string contents are stored as JSON. */
  add(name: string, contents: unknown, options?: { modifiedMs?: number }): void
  /** The inbox files by spool filename. */
  files(): ReadonlyMap<string, string>
  spooled(): readonly { name: string; json: string; generation: number }[]
  removed(): readonly string[]
  rejected(): readonly string[]
  promoted(): readonly {
    spoolName: string
    assetPath: string
    maxDim: number
    generation: number
  }[]
  hostRegistrations(): number
}

/**
 * An in-memory {@link CaptureInboxService}. `envelopes` and `shared` map
 * spool filenames to file contents; non-string contents are stored as JSON.
 * {@link CaptureInboxService.relaySharedInbox} moves the `shared` files into the inbox.
 */
export function createTestCaptureInboxService(options?: {
  envelopes?: Readonly<Record<string, unknown>>
  shared?: Readonly<Record<string, unknown>>
}): TestCaptureInboxService {
  const inbox = new Map<string, { contents: string; modifiedMs: number }>()
  const shared = new Map<string, string>()
  const spoolLog: { name: string; json: string; generation: number }[] = []
  const removeLog: string[] = []
  const rejectLog: string[] = []
  const promoteLog: { spoolName: string; assetPath: string; maxDim: number; generation: number }[] =
    []
  let registrations = 0

  function encode(contents: unknown): string {
    return typeof contents === 'string' ? contents : JSON.stringify(contents)
  }

  function add(name: string, contents: unknown, addOptions?: { modifiedMs?: number }): void {
    inbox.set(name, { contents: encode(contents), modifiedMs: addOptions?.modifiedMs ?? 0 })
  }

  for (const [name, contents] of Object.entries(options?.envelopes ?? {})) {
    add(name, contents)
  }
  for (const [name, contents] of Object.entries(options?.shared ?? {})) {
    shared.set(name, encode(contents))
  }

  return {
    async registerHost() {
      registrations += 1
    },
    list: async () =>
      [...inbox].map(([name, entry]) => ({
        path: `${INBOX_DIR}/${name}`,
        size: entry.contents.length,
        modifiedMs: entry.modifiedMs,
      })),
    async read(name) {
      const entry = inbox.get(name)
      if (entry === undefined) {
        throw notFound(`${INBOX_DIR}/${name}`)
      }
      return entry.contents
    },
    async spool(name, json, generation) {
      spoolLog.push({ name, json, generation })
      add(name, json)
    },
    async remove(name) {
      removeLog.push(name)
      inbox.delete(name)
    },
    async reject(name) {
      rejectLog.push(name)
      inbox.delete(name)
    },
    async relaySharedInbox() {
      const moved = shared.size
      for (const [name, contents] of shared) {
        add(name, contents)
      }
      shared.clear()
      return moved
    },
    async promoteScreenshot(spoolName, assetPath, maxDim, generation) {
      if (!inbox.has(spoolName)) {
        throw notFound(`${INBOX_DIR}/${spoolName}`)
      }
      promoteLog.push({ spoolName, assetPath, maxDim, generation })
    },
    add,
    files: () => new Map([...inbox].map(([name, entry]) => [name, entry.contents])),
    spooled: () => [...spoolLog],
    removed: () => [...removeLog],
    rejected: () => [...rejectLog],
    promoted: () => [...promoteLog],
    hostRegistrations: () => registrations,
  }
}

export type WebFetchKind = 'meta' | 'oembed' | 'image' | 'html' | 'icon'

export interface TestWebFetchService extends WebFetchService {
  requests(): readonly { kind: WebFetchKind; url: string }[]
}

/**
 * A {@link WebFetchService} that answers from per-URL tables. `html` answers
 * {@link WebFetchService.fetchMeta} and, with the URL as `finalUrl`,
 * {@link WebFetchService.fetchLinkPreviewHtml}. A URL missing from its table
 * rejects with a `notFound` error, except for `image`, which answers `null`.
 */
export function createTestWebFetchService(options?: {
  html?: Readonly<Record<string, string>>
  oembed?: Readonly<Record<string, string>>
  icon?: Readonly<Record<string, string>>
  image?: Readonly<Record<string, string>>
}): TestWebFetchService {
  const log: { kind: WebFetchKind; url: string }[] = []

  function answer(
    kind: WebFetchKind,
    table: Readonly<Record<string, string>> | undefined,
    url: string,
  ): string {
    log.push({ kind, url })
    const value = table?.[url]
    if (value === undefined) {
      throw notFound(`test ${kind} for ${url}`)
    }
    return value
  }

  return {
    fetchMeta: async (url) => answer('meta', options?.html, url),
    fetchOembed: async (url) => answer('oembed', options?.oembed, url),
    async fetchLinkPreviewImage(url) {
      log.push({ kind: 'image', url })
      return options?.image?.[url] ?? null
    },
    fetchLinkPreviewHtml: async (url): Promise<LinkPreviewHtml> => ({
      html: answer('html', options?.html, url),
      finalUrl: url,
    }),
    fetchLinkPreviewIcon: async (url) => answer('icon', options?.icon, url),
    requests: () => [...log],
  }
}

export interface TestXArchiveService extends XArchiveService {
  /** Archive `post` under `postId`, or drop the archive with `null`. */
  setPost(postId: string, post: ResolvedArchivedPost | null): void
  /** What the syndication API answers for `postId`. */
  setSyndication(postId: string, post: XPost | null): void
  resolves(): readonly { generation: number; postId: string }[]
  writes(): readonly { generation: number; post: ArchivedXPost }[]
  syndicationRequests(): readonly string[]
}

/**
 * An in-memory {@link XArchiveService}. `posts` are the archived posts by id;
 * {@link XArchiveService.write} archives a post with no resources. `owners`
 * maps an asset path to its archive files. Every graph generation shares
 * one archive.
 */
export function createTestXArchiveService(options?: {
  posts?: Readonly<Record<string, ResolvedArchivedPost>>
  syndication?: Readonly<Record<string, XPost>>
  owners?: Readonly<Record<string, readonly string[]>>
}): TestXArchiveService {
  const posts = new Map(Object.entries(options?.posts ?? {}))
  const syndication = new Map(Object.entries(options?.syndication ?? {}))
  const resolveLog: { generation: number; postId: string }[] = []
  const writeLog: { generation: number; post: ArchivedXPost }[] = []
  const syndicationLog: string[] = []

  return {
    async resolve(generation, postId) {
      resolveLog.push({ generation, postId })
      return structuredClone(posts.get(postId) ?? null)
    },
    owners: async (assetPath) => [...(options?.owners?.[assetPath] ?? [])],
    async write(generation, post) {
      writeLog.push({ generation, post })
      posts.set(post.data.id, { archive: { ...structuredClone(post) }, resources: [] })
    },
    async fetchSyndication(postId) {
      syndicationLog.push(postId)
      return structuredClone(syndication.get(postId) ?? null)
    },
    setPost(postId, post) {
      if (post === null) {
        posts.delete(postId)
      } else {
        posts.set(postId, post)
      }
    },
    setSyndication(postId, post) {
      if (post === null) {
        syndication.delete(postId)
      } else {
        syndication.set(postId, post)
      }
    },
    resolves: () => [...resolveLog],
    writes: () => [...writeLog],
    syndicationRequests: () => [...syndicationLog],
  }
}
