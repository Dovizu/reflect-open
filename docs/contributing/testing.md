# Testing

JS tests run on [Vitest](https://vitest.dev). Anything that needs a DOM uses
[Vitest browser mode](https://vitest.dev/guide/browser/) with the Playwright
provider, so it runs in a real browser. Rust tests are plain `cargo test`
(see `AGENTS.md`).

## Test projects

The root `vitest.config.ts` collects every app and package into one Vitest
workspace. Two packages split themselves into a browser project and a node
project:

- **`apps/desktop/vitest.browser.config.ts` (`browser`)**:
  `src/**/*.test.tsx`, executed in a real browser. Chromium by
  default; WebKit on demand (see below). Test files run sequentially
  (`fileParallelism: false`) because real keyboard focus is a per-page global.
- **`apps/desktop/vitest.node.config.ts` (`node`)**:
  `src/**/*.test.ts`, executed in a plain node environment.
- **`packages/core/vitest.browser.config.ts` (`core-browser`)**:
  `src/**/*.test.tsx`. Only `link-preview/metadata.test.tsx` lives here:
  `parsePageMeta` uses the host's `DOMParser`, and in production that host is
  always a browser (the Tauri webview, or the extension), never node.
- **`packages/core/vitest.node.config.ts` (`core-node`)**: `src/**/*.test.ts`,
  the rest of the package, in a plain node environment.

`packages/db`, `packages/utils` and `apps/extension` are pure node and have
no config of their own.

The routing rule is the file extension, with no exception list: `.test.ts`
means "pure logic, node environment", `.test.tsx` means "needs a DOM, real
browser". A logic test that drives the DOM (through `renderHook` or document
event listeners) is named `.test.tsx` for that reason alone. There is no
jsdom anywhere.

## Browsers

Chromium is the default. WebKit matters because the production desktop app
renders in a Tauri `WKWebView`, which is WebKit; CI runs both on every PR.
Firefox is intentionally not part of the matrix.

```bash
# one-time: download the browsers
pnpm --filter @reflect/desktop test:install

# run the browser project on Chromium
pnpm exec vitest run --project browser

# same, on WebKit
REFLECT_TEST_BROWSER=webkit pnpm exec vitest run --project browser

# watch a headed browser window while debugging
DEBUG=1 pnpm exec vitest --project browser path/to/test
```

## Console output fails tests

`vitest-fail-on-console` turns any `console.warn` / `console.error` during a
test into a failure, in every desktop and core project. The allowlist in
`apps/desktop/src/test-utils/allowed-console.ts` holds one entry, a browser
artifact (`ResizeObserver loop completed…`) that app code does not produce.
The rules:

- Do not add to the allowlist to make a test pass: fix the warning. A new
  entry needs a measured reason in that file.
- App code does not call `console` at all (lint enforces it); it logs through
  `LoggerService`.
- Import `act` from `@/test-utils/act.ts`, not from `react`: it sets React's
  act-environment flag for the call, which avoids the "not configured to
  support act" warning.
- Core services log through `LoggerService`, not the console. A test of an
  intentionally exercised error path passes a `createTestLoggerService()` and
  asserts on it: `expect(logger.getErrors()).toEqual([...])`. The test logger
  prints nothing.
- Desktop code that still logs to the console directly is asserted with a
  spy: `vi.spyOn(console, 'error').mockImplementation(() => {})`.

## Testing a service

A service is unit-tested by **constructing it over test doubles**. The doubles
come from `@reflect/core/testing` (`packages/core/src/testing/`): one
`createTestXxxService()` per service.

```ts
// packages/core/src/documents/note-move-service.test.ts
const ipc = createTestIpcBridgeService()
const indexStore = createTestIndexStoreService()
const openDocuments = createTestOpenDocumentsService({ sessions: [session] })
const logger = createTestLoggerService()
const noteMove = createNoteMoveService({ ipc, indexStore, openDocuments, logger })

await noteMove.moveNote('notes/a.md', 'notes/b.md', 7)

expect(indexStore.calls()).toEqual([
  { method: 'moveIndexed', from: 'notes/a.md', to: 'notes/b.md', fileGeneration: 7 },
])
```

Rules:

- Construct only the service under test and its direct dependencies.
- Prefer a **real** service over lower doubles to a double of every layer. To
  test `TaskService`, use the real `NoteDocumentService` and
  `OpenDocumentsService` and fake only the files. Most
  `createTestXxxService()` functions already are the real service over
  doubles.
- Do not use `vi.mock`, `vi.useFakeTimers` or console spies in a service test.
  The doubles replace them. The exception is the test of an edge
  implementation itself, such as the system clock or the console logger.

A `TestXxxService` is the service plus members that seed, drive or observe.
The ones used most:

| Double | Seed and drive | Observe |
|---|---|---|
| `createTestIpcBridgeService({ commands })` | `onCommand(command, handler)`, `emit(event, payload)` | `calls()` |
| `createTestClockService({ now, today })` | `advance(ms)` (runs due timers), `setNow(ms)`, `setToday(iso)` | `pendingTimers()` |
| `createTestLoggerService()` | | `getErrors()`, `getWarnings()`, `getInfos()` |
| `createTestOperationsService()` | | `getAll()`, `findByLabel(label)`, `snapshot()` |
| `createTestNoteFileService({ files })` | `set(path, contents)`, `evict(path)` | `files()`, `writes()`, `getWrites(path)`, `getReads()`, `trashed()` |
| `createTestDatabaseService()` | `applyProjection(note)`, `seedNotes(database, notes)` | `getQueries()` |
| `createTestIndexStoreService({ fail })` | | `calls()`, `applied()`, `removed()`, `moved()` |
| `createTestHttpService(routes)` | `on(method, url, reply)` | `requests()` |
| `createTestSettingsService(document)` | `seed(patch)`, `failLoad()`, `failNextSave()` | `saves()` |
| `createTestGraphSessionService()` | `setGraph(graph)`, `setState(patch)` | |
| `createTestNavigationService()` | | `navigations()` |
| `createTestLifecycleService()` | `emitHidden()`, `emitVisible()`, `emitWake()`, `emitQuitRequested()` | `backgroundTasks()` |
| `createTestClipboardService()`, `createTestOpenerService()` | `failWith(error)` | `writes()`, `openedUrls()` |

The test clock starts at epoch 0. `createTestDatabaseService()` is a real
in-memory SQLite index built from the production migrations, so index reads
are tested by seeding notes and asserting the query results, not by matching
SQL.

### `createTestAppServices()`

`createTestAppServices()` returns the whole `AppServices` object over test
doubles that share one clock, one note-file store, one database and one
logger. Its type, `TestAppServices`, keeps the test members:
`app.noteFile.getWrites(path)`, `app.clock.advance(ms)`. It also exposes the
services that `AppServices` keeps internal (`InternalServices`, e.g.
`app.database`) and always has `app.mobile`.

Pass overrides to replace a service. The other doubles are built over your
override:

```ts
const noteFile = createTestNoteFileService({ files: { 'notes/a.md': '# A\n' } })
const app = createTestAppServices({ noteFile })
```

Use it for desktop tests and for core tests of something that takes many
services. For a single service, construct the service directly.

## Testing React code

Components and hooks read services with `useAppServices()`, which throws
outside a provider. So every desktop test renders through one of two helpers
in `apps/desktop/src/test-utils/`. Each takes an optional `app` (default: a
fresh `createTestAppServices()`) and returns it, and each registers the app
commands in `app.commands`, as `main.tsx` does.

### `renderInApp(ui, options)`

`render-in-app.tsx`. Renders `ui` the way the app does: inside
`AppServicesProvider`, a query client, and the **real** `GraphProvider`,
`RouterProvider` and, on request, `SyncProvider`, all reading `app`. This is
the default for components.

```tsx
const { app } = await renderInApp(<RebuildIndexField />, { graph: { indexGeneration: 7 } })

await page.getByRole('button', { name: /rebuild/i }).click()

await vi.waitFor(() => expect(app.indexLifecycle.rebuilds()).toEqual([7]))
```

Options: `app`; `graph` (default: the graph `test` at `/graphs/test`, both
generations 1; `null` is the graph chooser) and `graphState`; `settings` (the
stored document, loaded before the first render); `mobile`; `route` (`null`
mounts no router); `sync`; `platform` (`MOBILE_PLATFORM` renders a mobile
surface); `queryClient`; `wrapper`; `servicesOnly`. The result adds `app`,
`queryClient` and `backup`.

Drive and observe the app through `app`, not through mocks:

- Change the graph with `app.graphSession.setGraph({...})` or `setGraph(null)`.
  No rerender is needed.
- Assert a settings change with `app.settings.get()` or `app.settings.saves()`.
- Assert navigation with `app.navigation.navigations()` or
  `app.navigation.getState().route`.
- Assert reported failures with `app.operations.getAll()`.

To script a call (a pending promise, a failure), **spy on your own `app`
before the render**. The providers read `service.method` during render and
hand that function to their context, so a spy installed later is not the
function the component calls:

```tsx
const app = createTestAppServices()
const rebuild = Promise.withResolvers<void>()
vi.spyOn(app.indexLifecycle, 'rebuildVisibly').mockReturnValueOnce(rebuild.promise)
await renderInApp(<RebuildIndexField />, { app, graph: { indexGeneration: 7 } })
```

With your own `app`, put the platform and the backup factory in it yourself
(`createTestAppServices({ platform: createTestPlatformService(MOBILE_PLATFORM) })`);
the helper throws if you pass both `app` and `platform`.

### `renderHookInApp(hook, options)`

The same tree and options for a hook, plus `initialProps`. It returns the
`renderHook` result with `app`, `queryClient` and `backup`.

```tsx
const settings = createTestSettingsService({ editorMarkdownSyntax: 'show' })
const app = createTestAppServices({ settings })
const { result, act } = await renderHookInApp(() => useSettings(), { app })

await act(() => {
  result.current.updateSettings({ editorFullWidth: true })
})
expect(result.current.settings.editorFullWidth).toBe(true)
```

### `servicesOnly`

`renderInApp(ui, { servicesOnly: true })` mounts only `AppServicesProvider` and
the query client: no graph, router or sync, and it does not wait for the
settings load. `app` keeps its own graph session. Use it for a provider under
test, or a component that needs the services and nothing else.

```tsx
const view = await renderInApp(<CaptureProvider graph={GRAPH}>child</CaptureProvider>, {
  servicesOnly: true,
})

expect(view.app.capture.sessions()).toEqual([
  { generation: 7, starts: 1, schedules: 0, disposed: false },
])
```

### The test database in the browser

`createTestDatabaseService()` uses `node:sqlite`, which a browser does not
have. `apps/desktop/src/test-utils/setup-browser.ts` installs a wasm backend
with `setTestDatabaseOpener`, so in browser tests the same call returns a
**lazy** wasm database:

- It opens on the first query. A test that never reads the index loads no
  wasm.
- `applyProjection` before the first query is held and applied when the
  database opens.
- The first index read of a file is slower (the wasm import). Wait with
  `expect.element` or `vi.waitFor`, never with a fixed delay.

Use the **eager** database when the test needs the index open before its
first query, for example when it types and immediately presses a key that
depends on a query result. Open it first and pass it as the override
(`daily-events-section.test.tsx`):

```ts
import { createWasmTestDatabaseService } from '@/test-utils/test-database.ts'

const database = await createWasmTestDatabaseService()
const app = createTestAppServices({ database })
```

### `vi.mock` is only for pure UI children

Do not mock `@reflect/core`, a service, a provider that reads a service
(`graph-provider`, `settings-provider`, `sync-provider`), the router, or
`lib/query-client.ts`. Seed or spy on `app` instead. Mocking a module that the
helper's providers import breaks the helper.

`vi.mock` is allowed for:

- a **pure UI child** that is irrelevant to the test or heavy to mount:
  `components/ui/drawer.tsx`, `editor/note-editor.tsx`,
  `editor/markdown-preview.tsx`, a sibling screen;
- the `@tauri-apps/*` package under test in an adapter test
  (`services/tauri-http.test.ts`).

Core tests use no `vi.mock` at all.

## Timing pitfalls

**Do not `flush()` with a timer turn when the work is off the timer queue.**
A helper like `await new Promise((resolve) => setTimeout(resolve, 0))` only
waits for work that is itself scheduled on timers or microtasks. WebCrypto
digests (the real hash service), wasm and IPC resolve on their own schedule,
so one timer turn is sometimes enough and sometimes not, and the test flakes.
Wait for the outcome with `vi.waitFor`, or count the work in flight and wait
until it is zero for two consecutive turns, as `flush()` in
`packages/core/src/assets/asset-description-service.test.ts` does. Time that
the service schedules through `ClockService` is advanced with
`clock.advance(ms)`, not by waiting.

**Editor tests: `unhover()` before the render, and wait for view
transitions.** Both are in `apps/desktop/src/editor/note-editor.test.tsx`:

- The mouse position persists across tests. If the previous test left the
  pointer where a link of this test renders, the browser fires `mouseover`
  during the render, before the editor's hover handlers are attached, and the
  later `hover()` on the same element fires nothing. Call `await unhover()`
  (`test-utils/mouse.ts`) before `render` in any test that hovers.
- The lightbox opens and closes inside a React view transition. The assertion
  can pass while the transition is still preparing; the next test's unmount
  then cancels it, React warns, and fail-on-console fails the **next** test.
  Wait for it in `afterEach`: `await document.activeViewTransition?.finished`.

## Browser test conventions

- Assert DOM state through locators with auto-retry:
  `await expect.element(page.getByTestId('x')).toBeVisible()`. No
  `document.querySelector`, no `vi.waitFor` around DOM reads (`vi.waitFor`
  stays for spy assertions and geometry reads).
- `page.locate('<css>')` (registered by `src/test-utils/locator.ts`) is the
  escape hatch for CSS selectors; prefer semantic locators (`getByRole`,
  `getByText`) or `data-testid`. Third-party intrinsic classes
  (`.ProseMirror`) are fine to locate.
- Counting matches needs `expectLocatorToHaveCount` from
  `src/test-utils/expect.ts` (`expect.element` silently picks the first
  match).
- Mount React components with `renderInApp` (above), which wraps `render`
  from `vitest-browser-react`; drive input with `userEvent` from
  `vitest/browser` (real key events, no `setup()`).
- `view.rerender(<X />)` keeps the providers: pass only the bare element.
- The app stylesheet (`src/styles/index.css`, Tailwind included) is loaded in
  every browser test via `src/test-utils/setup-browser.ts`, so layout is
  real.
- Platform-specific skips need a stated engine difference, not a convenience
  skip.
