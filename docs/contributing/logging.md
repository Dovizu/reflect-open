# Logging

Where log lines go, how to write one, and what must never be in one.

## Where lines end up

[`tauri-plugin-log`](https://v2.tauri.app/plugin/logging/) owns the sinks
(`apps/desktop/src-tauri/src/logging.rs`): stderr (the OS log on mobile) and
`reflect.log` under the OS log directory (`~/Library/Logs/<bundle id>/` on
macOS). The file rotates at 5 MB and three rotated files are kept. Timestamps
are UTC. A user who hits a problem can send that folder; nobody has to
relaunch the app from a terminal.

- **Rust** uses `tracing`. No `tracing` subscriber is installed: the crate's
  `log` feature turns every event into a `log` record, with fields rendered
  as `key=value` after the message.
- **TypeScript** uses `createLogger(module)` from `@reflect/core`. Every line
  goes to the console and, when a bridge is installed, to the plugin's
  `plugin:log|log` command under the `webview::<module>` target. TypeScript
  and Rust lines therefore sort together in one file.
- `RUST_LOG` sets one global level for both sinks (`info` by default).
  `RUST_LOG=debug` from a terminal shows per-item `debug` lines that the file
  normally skips. Per-target directives are not supported.
- The logger starts in the Tauri `setup` hook. Lines logged before that are
  dropped.

## Writing a line

```ts
const log = createLogger('embeddings')

log.info('backfill finished', { outcome, notes: rows.length, chunksEmbedded, elapsedMs })
log.error('backfill failed for a note', { path: row.path, ...errorField(cause) })
```

- `module` is short and stable (`embeddings`, `indexing`, `sync`): it is the
  field to grep for.
- The message is a fixed phrase; the variable parts go in fields. Fields are
  flat scalars and render as one JSON object after the message.
- `errorField(cause)` turns a caught value into `{ error }` through
  `errorMessage`, so every error line names its cause the same way.
- Long operations log **one summary at the end** with counts and `elapsedMs`
  (see `backfillEmbeddings`, or `git_commit_all` on the Rust side). Per-item
  lines are `debug`, and only for items that did work: a backfill over 2.5k
  notes must not produce 2.5k lines.

In Rust the same shape is `tracing::info!(committed, ahead, elapsed_ms, "git_commit_all")`.

## What must not be logged

The log directory is outside the graph and outside the `private: true` guard.
Lines carry paths, counts, durations, and error messages: never note text,
note titles, or anything derived from note content. Error messages from
providers can quote request data; log `errorMessage(cause)`, not the raw body.
