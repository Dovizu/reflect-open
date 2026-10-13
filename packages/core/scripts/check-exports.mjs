// Checks the public surface of `@reflect/core` against its consumers:
// 1. every name the package barrel exports is referenced in `apps/desktop/src`
//    or `apps/extension` (a word match), or is in `ALLOWLIST`;
// 2. every `AppServices` and `MobileServices` field is read by a desktop
//    non-test file (`.field`, a `useAppServices()` destructuring, or a
//    `Pick<AppServices, ...>`).
// Exits 1 and lists the offenders when either check fails.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const coreDir = join(import.meta.dirname, '..')
const repoDir = join(coreDir, '..', '..')
const desktopDir = join(repoDir, 'apps', 'desktop', 'src')
const extensionDir = join(repoDir, 'apps', 'extension')

/** The composition root and the adapter interfaces the desktop app implements. */
const ALLOWLIST = [
  'createAppServices',
  'AppAdapters',
  'AppServices',
  'GraphServices',
  'GraphSession',
  'IpcBridge',
  'WindowHost',
  'OpenerTransport',
  'PathTransport',
  'LifecycleDomAdapter',
  'UpdaterAdapter',
  'NativeMenuHost',
  'DeepLinkSource',
  'FileSrcConverter',
  'PlatformFacts',
  'ExceptionTelemetryService',
  'ImageCodecService',
  'HttpService',
  'DialogService',
  'ClipboardService',
  'LoggerService',
]

const SOURCE_FILE = /\.[cm]?[jt]sx?$/
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.output', '.wxt', 'target'])

function listFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) files.push(...listFiles(join(dir, entry.name)))
    } else if (SOURCE_FILE.test(entry.name)) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

/** The names that the `export { ... } from` statements of `file` export. */
function barrelNames(file) {
  const names = []
  const source = readFileSync(file, 'utf8')
  for (const [, list] of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from/g)) {
    for (const raw of list.split(',')) {
      const spec = raw.replace(/^\s*type\s+/, '').trim()
      if (spec === '') continue
      const alias = /\sas\s+(\w+)$/.exec(spec)
      names.push(alias ? alias[1] : spec)
    }
  }
  return names
}

function packageBarrelNames() {
  const index = join(coreDir, 'src', 'index.ts')
  const names = barrelNames(index)
  for (const [, path] of readFileSync(index, 'utf8').matchAll(/export \* from '([^']+)'/g)) {
    names.push(...barrelNames(join(dirname(index), path)))
  }
  return names
}

function interfaceFields(source, name) {
  const start = source.indexOf(`export interface ${name} {`)
  if (start === -1) throw new Error(`check-exports: no interface ${name}`)
  const body = source.slice(start, source.indexOf('\n}\n', start))
  return [...body.matchAll(/^ {2}readonly (\w+)\??:/gm)].map((match) => match[1])
}

const failures = []

const words = new Set()
for (const file of [...listFiles(desktopDir), ...listFiles(extensionDir)]) {
  for (const [word] of readFileSync(file, 'utf8').matchAll(/[A-Z_$][\w$]*/gi)) words.add(word)
}
const exported = packageBarrelNames()
const unreferenced = exported.filter((name) => !words.has(name) && !ALLOWLIST.includes(name))
if (unreferenced.length > 0) {
  failures.push(
    `${unreferenced.length} of ${exported.length} names exported from @reflect/core are not ` +
      `referenced in apps/desktop/src or apps/extension. Remove them from the barrel in ` +
      `packages/core/src/exports/, or add them to ALLOWLIST:\n  ${unreferenced.join('\n  ')}`,
  )
}

const appSource = readFileSync(join(coreDir, 'src', 'app', 'create-app-services.ts'), 'utf8')
const fields = [
  ...interfaceFields(appSource, 'AppServices'),
  ...interfaceFields(appSource, 'MobileServices'),
]
const desktopApp = listFiles(desktopDir)
  .filter((file) => !/\.test\.[jt]sx?$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
const destructured = new Set()
for (const [, braces, picked] of desktopApp.matchAll(
  /\{([^{}]*)\}\s*=\s*use(?:Mobile)?AppServices\(\)|Pick<\s*AppServices\s*,([^>]*)>/g,
)) {
  for (const [word] of (braces ?? picked).matchAll(/\w+/g)) destructured.add(word)
}
const unread = fields.filter(
  (field) => !destructured.has(field) && !new RegExp(String.raw`\.${field}\b`).test(desktopApp),
)
if (unread.length > 0) {
  failures.push(
    `${unread.length} AppServices fields are not read by a desktop non-test file. Keep them as ` +
      `locals in composeAppServices and list them in InternalServices ` +
      `(packages/core/src/app/create-app-services.ts):\n  ${unread.join('\n  ')}`,
  )
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exit(1)
}
console.log(
  `check-exports: ${exported.length} exports and ${fields.length} AppServices fields, all used ` +
    `(${relative(repoDir, desktopDir)}).`,
)
