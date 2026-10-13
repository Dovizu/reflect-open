# Adding a service

All stateful logic in `@reflect/core` is a **service**. A composition root builds
every service once and passes each one the services it calls. There are no global
instances. The conventions are in
[architecture-conventions](../plans/architecture-conventions.md) §3; this guide
walks through the work of adding one, with `NoteMoveService`
(`packages/core/src/documents/note-move-service.ts`) as the running example. It
is small, and it has dependencies, state, an event and a test double.

```text
packages/core/src/documents/note-move-service.ts       interface + factory
packages/core/src/documents/note-move-service.test.ts  the test, over test doubles
packages/core/src/testing/documents.ts                 createTestNoteMoveService
packages/core/src/app/create-app-services.ts           AppServices.noteMove
packages/core/src/testing/services.ts                  createTestAppServices, the test factory table
apps/desktop/src/routing/router.tsx                    useAppServices().noteMove
```

## Do you need a service?

- **A pure rule** (a path helper, a markdown transform, a grouping) is a plain
  exported function. It needs no service.
- **A new operation in an existing domain** is a new method on the service that
  owns the domain. A new Rust command is this case: see
  [adding-a-command](adding-a-command.md).
- **A new service** is for a new unit with its own dependencies or its own state:
  a cache, a queue, a set of listeners, a lifecycle.

## 1. The interface and the factory

One file, `packages/core/src/<domain>/<name>-service.ts`, exports the interface
`XxxService` and the factory `createXxxService(deps)`:

```ts
// packages/core/src/documents/note-move-service.ts
export interface NoteMoveService {
  /** Move a note's file and projection, carrying any live editor session along. */
  moveNote(from: string, to: string, generation: number): Promise<void>
  /** Follow a move the index healed by id. */
  followHealedMove(this: void, from: string, to: string): void
  /** Subscribe to landed note moves; returns the unsubscribe. */
  onMoved(listener: NoteMovedListener): Unlisten
  /** Follow the Rust-side `note:moved` broadcast. */
  followNativeMoves(): Unlisten
}

export interface NoteMoveServiceDeps {
  ipc: Pick<IpcBridgeService, 'listen'>
  indexStore: Pick<IndexStoreService, 'moveIndexed'>
  openDocuments: Pick<OpenDocumentsService, 'sessionFor' | 'retarget'>
  logger: Pick<LoggerService, 'error' | 'warn'>
}

export function createNoteMoveService(deps: NoteMoveServiceDeps): NoteMoveService {
  const { ipc, indexStore, openDocuments, logger } = deps
  const listeners = new Set<NoteMovedListener>()
  // ...
  return {
    async moveNote(from, to, generation) {
      // ...
    },
    followHealedMove,
    onMoved(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    // ...
  }
}
```

Rules:

- The factory returns an **object literal**. Do not write a class.
- Document the interface, not the implementation: the doc comments on the
  interface are the service's contract.
- The interface never mentions `deps`.
- A method that callers pass around without its object (to
  `useSyncExternalStore`, as an event listener) must not depend on `this`.
  Declare it as a function property (`get: () => Settings` in
  `SettingsService`) or with `this: void`, as `followHealedMove` does.
- A method that writes to the graph pins the write to one graph session. §2
  says how the method gets that session.
- Throw `AppError` for failures a caller handles. Validate IPC responses and
  event payloads with zod (`noteMovedSchema` in the example).

## 2. `deps`

`deps` is one object, destructured on the first line of the factory.

- Put in it every other service the new one calls: `ipc` for native commands,
  `logger` instead of `console.*`, `clock` instead of `Date.now()` and
  `setTimeout`, `id` instead of `crypto.randomUUID()`, `http` instead of
  `fetch`. This is what lets a test control them.
- Declare each dependency as `Pick<XxxService, 'method'>` of the methods the
  service actually calls, as the example does.
  `packages/core/src/capture/capture-service.ts` is the model:
  `noteFile: Pick<NoteFileService, 'read' | 'write' | 'listNotes'>`,
  `clock: Pick<ClockService, 'now'>`. A test double then only has to implement
  those methods, and the dependency graph shows which methods each service
  uses.
- Do not import another service's instance, and do not read a global.
  `@reflect/core` has none.
- Do not pass a service as an argument of a method. If two services need each
  other, one of them takes a narrow function in `deps` instead, or the shared
  part becomes a third service.

### The open graph

Rust rejects a graph write whose `generation` is not the open graph's. Index
writes carry the index generation (`indexGeneration`) the same way. Which side
holds the generation depends on the kind of service:

- **Rust-boundary wrappers** take an explicit `generation` parameter and pass
  it to the IPC command. `NoteFileService` is the model:
  `write(path, contents, generation)`. A background pass then writes with the
  session it started with, and Rust rejects the write after a graph switch.
- **User-facing services** (what hooks, commands and screens call) take no
  `generation`. They take `graphSession: GraphSessionSource` in `deps` and read
  the session once, at the entry of each public method:
  `graphSession.getState().session`, or `requireGraphSession(graphSession)`
  (`app/graph-session.ts`) where no open graph is an error. They pass
  `session.generation` and `session.indexGeneration` to every lower call of
  that invocation. Do not read the session again after an `await`.
  `NoteActionsService` is the model: `togglePinned(path)` returns `failed`
  with no graph open, and `trashOne(path)` throws `No graph is open.`.
- **Background loops** (backup, capture, asset description, iCloud sync) get
  the `GraphSession` or its generations from `createGraphServices` (§10).

`indexGeneration` is `null` when the index failed to open. Skip the index write
then.

## 3. Where state lives

State is a `const` or `let` inside the factory, captured by the returned
methods: `listeners` in the example, `current` and `dirty` in
`settings/settings-service.ts`. One call to the factory is one independent
instance. Module-level `let` and module-level caches are not allowed: two tests,
or two webviews in one process, would share them.

If the UI reads the state, expose it as a store: a snapshot getter that returns
the same object until something changes, plus `subscribe(listener): Unlisten`
(`SettingsService.get` / `subscribe`, `GraphSessionService.getState` /
`subscribe`).

## 4. Events

Core does not know about the UI's caches. A service that changes something
others care about **emits an event** instead of writing to a cache:

- The method is `onXxx(listener): Unlisten` (`onMoved`, `onApplied`,
  `onXPostsWritten`). It registers synchronously and returns the unsubscribe.
- Isolate listeners. `emitMoved` in the example wraps each call in `try` /
  `catch` and logs, because a throwing subscriber must not turn a move that
  landed into a reported failure.
- Optimistic state is a core overlay (`NoteRowService`); the app only
  invalidates queries. A note action records what it writes there
  (`noteActions.togglePinned` records `isPinned` and `pinnedOrder`), readers
  merge it over the index rows, and it retires when the index agrees. Do not
  add a callback for the UI to patch its cache.

The desktop app subscribes and decides what an event means for it: the router
rewrites its history on `noteMove.onMoved`, and `lib/query-invalidation.ts`
invalidates queries on `indexLifecycle.onApplied`.

## 5. Add it to the composition root

In `packages/core/src/app/create-app-services.ts`:

1. Add the field to `AppServices`: `readonly noteMove: NoteMoveService`.
2. Add the factory to `appServiceFactories`, the table of every service key
   and the factory that builds it: `noteMove: createNoteMoveService`.
3. Build it in `composeAppServices`, after the services it depends on, through
   the table, and return it:

   ```ts
   const noteMove = create.noteMove({ ipc, indexStore, openDocuments, logger })
   ```

4. Add the key to `SERVICE_KEYS` in `create-app-services.test.ts`.
5. Export the names the app imports from a barrel in `packages/core/src/exports/`
   (`NoteMoveService` is in `platform.ts`). The apps import only from the package
   root. The factory and its `XxxServiceDeps` stay out of the barrel: only
   `createAppServices` builds services. `pnpm lint` runs
   `packages/core/scripts/check-exports.mjs`, which fails on a barrel name that
   no app file references and on an `AppServices` field that no desktop
   non-test file reads.

`composeAppServices(adapters, factories)` is the one composition root. It
builds every service in a fixed order and passes each factory the same
dependencies. `createAppServices(adapters)` calls it with the production table
and returns `AppServices`; `createTestAppServices()` calls it with test
adapters and a table that replaces some factories. A replacement factory gets
the same dependencies as the production one and may ignore them.

`AppServices` holds only the services that the app reads. A service that only
other services use stays a local in `composeAppServices`; list it in
`InternalServices` (same file) instead, so tests still reach it through
`TestAppServices`.

A service that only a mobile platform needs goes in `MobileServices`, which
`AppServices.mobile` holds (`null` off mobile). `composeAppServices` builds it
in `createMobileServices()`, which the `mobile` factory runs only on a mobile
platform. The mobile tree reads it with `useMobileAppServices()`.

## 6. The test double

`createTestAppServices()` builds the app through the same composition root.
By default a service in a test is the **real service** over the test doubles
of its dependencies, so the real logic runs in every consumer's test. Add a
test double only when the real service cannot run in a test, or a test must
script or observe it:

- **In-memory fake** for a service at the edge, where the real one would need
  a native capability: files (`createTestNoteFileService`), IPC, HTTP, the
  clock, the database, the keychain.
- **Scripted fake** for a service whose real answer comes from outside: the
  language model, transcription, retrieval.
- **Recording wrapper** around the real service, when tests read what it did
  (`moved()`, `calls()`) or seed its state (`setGraph()`, `setState()`).

```ts
// packages/core/src/testing/documents.ts
export interface TestNoteMoveService extends NoteMoveService {
  /** Every move announced to the subscribers, in order. */
  moved(): ReadonlyArray<readonly [from: string, to: string]>
}

export function createTestNoteMoveService(
  options?: Partial<NoteMoveServiceDeps>,
): TestNoteMoveService {
  const service = createNoteMoveService({
    ipc: options?.ipc ?? createTestIpcBridgeService(),
    indexStore: options?.indexStore ?? createTestIndexStoreService(),
    openDocuments:
      options?.openDocuments ??
      createOpenDocumentsService({ fileChanges: createTestFileChangeService() }),
    logger: options?.logger ?? createTestLoggerService(),
  })
  const moves: Array<readonly [string, string]> = []
  service.onMoved((from, to) => {
    moves.push([from, to])
  })
  return { ...service, moved: () => [...moves] }
}
```

Rules:

- Do not write a `createTestXxxService` that only calls `createXxxService`
  over default doubles. A test builds the real service over the doubles it
  needs, or takes it from `createTestAppServices()`.
- `TestXxxService extends XxxService`. The extra members only **observe**
  (`moved()`, `calls()`, `getWrites()`) or **seed and drive** (`set()`,
  `emit()`, `setState()`). They never change what the real methods mean.
- Add the double to the test factory table in `testing/services.ts`
  (`noteMove: (deps) => createTestNoteMoveService(deps)`). `TestAppServices`
  takes the member type from the table, so tests get `app.noteMove.moved()`.

## 7. The test

The test is next to the service and constructs it directly over test doubles.
No `vi.mock`, no fake timers, no console spies:

```ts
// packages/core/src/documents/note-move-service.test.ts
function setup(options?: { sessions?: readonly NoteSession[]; moveError?: Error }) {
  const ipc = createTestIpcBridgeService()
  const indexStore = createTestIndexStoreService({
    fail: (call) => (call.method === 'moveIndexed' ? options?.moveError : undefined),
  })
  const openDocuments = createOpenDocumentsService({ fileChanges: createTestFileChangeService() })
  for (const session of options?.sessions ?? []) {
    openDocuments.register({ session })
  }
  const logger = createTestLoggerService()
  const noteMove = createNoteMoveService({ ipc, indexStore, openDocuments, logger })
  const moves: Array<[string, string]> = []
  noteMove.onMoved((from, to) => {
    moves.push([from, to])
  })
  return { ipc, indexStore, openDocuments, logger, noteMove, moves }
}

it('flushes, retargets, re-keys, moves, and announces', async () => {
  const session = createTestNoteSession({ path: 'notes/a.md' })
  const { noteMove, openDocuments, indexStore, moves } = setup({ sessions: [session] })

  await noteMove.moveNote('notes/a.md', 'notes/b.md', 7)

  expect(session.path).toBe('notes/b.md')
  expect(openDocuments.sessionFor('notes/b.md')).toBe(session)
  expect(indexStore.calls()).toEqual([
    { method: 'moveIndexed', from: 'notes/a.md', to: 'notes/b.md', fileGeneration: 7 },
  ])
  expect(moves).toEqual([['notes/a.md', 'notes/b.md']])
})
```

Construct only the service under test and its direct dependencies. Assert through
the doubles: `logger.getErrors()`, `indexStore.calls()`, `ipc.emit(event,
payload)`, `clock.advance(ms)`. [Testing](testing.md) lists the doubles and the
pitfalls.

## 8. Use it from the app

**React.** Read the service with `useAppServices()` and destructure it. Do not
add a `useNoteMoveService()` hook.

```tsx
// apps/desktop/src/routing/router.tsx
const { navigation: appNavigation, noteMove } = useAppServices()

useEffect(
  () => noteMove.onMoved((from, to) => navigation.noteMoved(from, to)),
  [navigation, noteMove],
)
```

- An event subscription is a `useEffect` that returns the unsubscribe.
- A store is read with `useServiceState(service)` (or
  `useServiceState(service, service.get)` for a getter with another name),
  from `apps/desktop/src/services/use-service-state.ts`. Read an app-scoped
  service where it is used, as `useSettings()` does. Read a graph-scoped
  instance from `useGraphServices()`, as `useChatSession()` does. A provider
  is only for an instance it creates (`AudioMemoProvider`); its context value
  is the state spread with the instance, and it holds no logic of its own.
- Query-backed reads call the service in the `queryFn`. Put the options in
  `apps/desktop/src/lib/query-options.ts`, with the services as `ctx`.

**Non-React modules** in `apps/desktop/src/lib/` and `providers/*.ts` take the
services as a first parameter `ctx`, typed as the `Pick` they use. The React
caller passes `useAppServices()`:

```ts
// apps/desktop/src/providers/graph-session.ts
export function bootGraphSession(
  ctx: Pick<AppServices, 'graphSession' | 'deepLink' | 'window'>,
): Unlisten
```

**Commands** read `context.services` (`CommandContext` in
`apps/desktop/src/lib/commands/types.ts`).

Never import `appServices` from `apps/desktop/src/boot.ts`. Only `main.tsx` and
the platform roots do.

## 9. If it needs a platform API

A Rust command needs nothing new: take `ipc` in `deps` and call
`ipc.call(command, args, schema)`.

A JavaScript-side platform API (a Tauri plugin package, a browser API that does
not exist in tests) needs an **adapter**, because `@reflect/core` must not import
`@tauri-apps/*`:

1. Define the adapter interface in core, next to the service. `UpdaterAdapter`
   in `app/update-service.ts` is `{ check, relaunch }`.
2. Take it in the service's `deps`, and add a field to `AppAdapters` in
   `create-app-services.ts` (`readonly updater?: UpdaterAdapter`). Make it
   optional when a host can lack it, and decide what the service does then.
3. Implement it in `apps/desktop/src/services/`
   (`tauri-updater.ts` imports `@tauri-apps/plugin-updater`), and pass it in
   `createDesktopAdapters` (`create-desktop-services.ts`): in the native-shell
   branch, and a browser equivalent in the other branch if plain-browser dev
   needs one.
4. Give the adapter a test double (`createTestUpdaterAdapter`), and build the
   test service as the real one over it.

Keep the adapter as thin as the examples: it translates calls, and every
decision stays in the core service.

## 10. When to make it a per-session factory

An app-scoped service lives as long as the webview. Make the service a factory,
or give it an `openSession(options)` method, when an instance must **start and
stop with something shorter-lived**:

- it runs a loop, timers or subscriptions for one open graph or one index
  session (`backups.create({ generation, indexGeneration })`,
  `capture.openSession({ generation })`);
- its state must not survive a graph switch (`chatSessions.create({ session })`:
  a pending turn of the previous graph must not be saved into the next one);
- there is one per UI surface (`noteSessions.create(options)` per note pane).

The shape:

- `AppServices` holds the factory (`backups: BackupServiceFactory`). The factory
  closes over the `deps`; `create(options)` takes what identifies the session.
- The instance exposes `start()` and `dispose()`, plus `getState()` /
  `subscribe()` when the UI reads it.
- A per-graph lifecycle is constructed in `createGraphServices`
  (`app/create-graph-services.ts`). `GraphSessionService` calls it when a graph
  reaches `ready` (also when its index failed to open: `indexGeneration` is
  then null), publishes the result as
  `GraphSessionState.services`, and aborts `GraphSession.signal` when the graph
  closes or another open starts; the container disposes everything it started
  on that abort. The app reads it with `useGraphServices()`.
- A lifecycle only the main window may run is built only for
  `role === 'main'`; its field is `null` in a note window. Do not check
  `isMainWindow()` in a React effect.
- A background pass that must stop with the graph takes the `GraphSession` and
  checks `session.signal.aborted`, not an `isStale` callback
  (`indexLifecycle.sync(session)`).
- A provider creates an instance in an effect only when it needs UI callbacks
  (`AudioMemoProvider` passes its `surface`).
- What all sessions share stays on the app-scoped object
  (`capture.onXPostsWritten`).

Ordinary services stay app-scoped and read the open graph's session per call
(§2, "The open graph").

## Checklist

- [ ] `packages/core/src/<domain>/<name>-service.ts`: documented `XxxService`
      interface, `createXxxService(deps)` returning an object literal
- [ ] Every collaborator comes through `deps`, narrowed with `Pick<>`; no
      `console.*`, `Date.now()`, `setTimeout`, `fetch` or `@tauri-apps/*`
- [ ] State inside the factory; changes reported through `onXxx(listener)` /
      `subscribe(listener)`
- [ ] In `appServiceFactories` and built in `composeAppServices`; on
      `AppServices` (key in `SERVICE_KEYS`) only when the app reads it, else in
      `InternalServices`; the names the app imports exported from
      `packages/core/src/exports/`
- [ ] A `createTestXxxService` in `packages/core/src/testing/` and an entry in
      the test factory table of `testing/services.ts`, only for a fake or a
      recording wrapper (see §6)
- [ ] `<name>-service.test.ts` constructing the service over test doubles
- [ ] App code reads it with `useAppServices()`, `ctx`, or
      `CommandContext.services`
- [ ] Adapter in `apps/desktop/src/services/` and a field on `AppAdapters`, only
      if it needs a JavaScript-side platform API
- [ ] `pnpm typecheck && pnpm lint && pnpm test --run <touched paths>`
