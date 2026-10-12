/** Host filesystem path building, in the host platform's path syntax. */
export interface PathService {
  join(...parts: string[]): Promise<string>
  /** The current user's home directory. */
  homeDir(): Promise<string>
  /** The macOS iCloud Drive folder under {@link homeDir}. */
  icloudDriveRoot(): Promise<string>
}

/** The native operations behind a {@link PathService}. */
export interface PathTransport {
  join(...parts: string[]): Promise<string>
  homeDir(): Promise<string>
}

const ICLOUD_DRIVE_SEGMENTS = ['Library', 'Mobile Documents', 'com~apple~CloudDocs'] as const

export function createPathService(deps: { transport: PathTransport }): PathService {
  const { transport } = deps
  return {
    join: (...parts) => transport.join(...parts),
    homeDir: () => transport.homeDir(),
    icloudDriveRoot: async () =>
      await transport.join(await transport.homeDir(), ...ICLOUD_DRIVE_SEGMENTS),
  }
}

/** A {@link PathTransport} with POSIX syntax and a fixed home directory. */
export function createPosixPathTransport(home: string): PathTransport {
  return {
    join: async (...parts) => joinPosix(parts),
    homeDir: async () => home,
  }
}

function joinPosix(parts: readonly string[]): string {
  const absolute = parts[0]?.startsWith('/') ?? false
  const segments: string[] = []
  for (const part of parts) {
    for (const segment of part.split('/')) {
      if (segment === '' || segment === '.') {
        continue
      }
      if (segment === '..' && segments.length > 0 && segments.at(-1) !== '..') {
        segments.pop()
      } else if (segment !== '..' || !absolute) {
        segments.push(segment)
      }
    }
  }
  const joined = segments.join('/')
  if (absolute) {
    return `/${joined}`
  }
  return joined === '' ? '.' : joined
}
