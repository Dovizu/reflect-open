//! Where log lines go. `tracing` output reaches stderr from the first line
//! (`RUST_LOG`, default `info`) and, once the app handle exists, a
//! daily-rolling file under the OS log directory as well, so a user can
//! send the log folder instead of relaunching from a terminal. The webview
//! feeds the same pipeline through [`log_event`], so TypeScript and Rust
//! lines sort together in one file.
//!
//! Lines carry paths, counts, and durations, never note text: the log
//! directory is outside the graph and is not covered by the `private: true`
//! guard, so content must not reach it.

use std::sync::OnceLock;

use serde::Deserialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};
use tracing_subscriber::filter::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{fmt, reload, Layer, Registry};

/// Log files to keep: one per day of use.
const MAX_LOG_FILES: usize = 7;

type FileLayer = Box<dyn Layer<Registry> + Send + Sync>;

/// Swaps the (initially absent) file layer in once the log dir is known.
static FILE_LAYER: OnceLock<reload::Handle<Option<FileLayer>, Registry>> = OnceLock::new();

/// Install the global subscriber: stderr now, the file layer later via
/// [`attach_log_file`]. `try_init` so a second call (tests, mobile re-entry)
/// is a no-op, not a panic.
pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let (file_layer, handle) = reload::Layer::new(None::<FileLayer>);
    let installed = Registry::default()
        .with(file_layer)
        .with(fmt::layer().with_writer(std::io::stderr))
        .with(filter)
        .try_init()
        .is_ok();
    if installed {
        let _ = FILE_LAYER.set(handle);
    }
}

/// Start writing to `<app log dir>/reflect.<date>.log` (macOS:
/// `~/Library/Logs/<bundle id>/`), rotating daily and keeping
/// [`MAX_LOG_FILES`]. Failures are logged and otherwise ignored: a missing
/// log file must never block launch.
pub fn attach_log_file(app: &AppHandle) {
    let Some(handle) = FILE_LAYER.get() else {
        return; // another subscriber owns the process (tests)
    };
    let dir = match app.path().app_log_dir() {
        Ok(dir) => dir,
        Err(err) => {
            tracing::warn!(error = %err, "no app log dir; logging to stderr only");
            return;
        }
    };
    let appender = tracing_appender::rolling::Builder::new()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("reflect")
        .filename_suffix("log")
        .max_log_files(MAX_LOG_FILES)
        .build(&dir);
    let appender = match appender {
        Ok(appender) => appender,
        Err(err) => {
            tracing::warn!(dir = %dir.display(), error = %err, "log file unavailable; logging to stderr only");
            return;
        }
    };
    let layer: FileLayer = fmt::layer().with_ansi(false).with_writer(appender).boxed();
    if let Err(err) = handle.reload(Some(layer)) {
        tracing::warn!(error = %err, "attaching the log file layer failed");
        return;
    }
    tracing::info!(
        dir = %dir.display(),
        version = env!("CARGO_PKG_VERSION"),
        "log file attached"
    );
}

/// Severity of a webview log line; mirrors `LogLevel` in `@reflect/core`.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WebviewLogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

/// A log line from the webview (`createLogger` in `@reflect/core`). `module`
/// is the TypeScript logger's target (`embeddings`, `indexing`, ...);
/// `fields` is the structured payload, rendered as JSON on the line because
/// `tracing` fields are static. Never fails: logging must not produce errors
/// the caller would then want to log.
#[tauri::command]
pub fn log_event(
    level: WebviewLogLevel,
    module: String,
    message: String,
    fields: Option<Map<String, Value>>,
) {
    let fields = render_fields(fields);
    match level {
        WebviewLogLevel::Debug => {
            tracing::debug!(target: "webview", module, fields, "{message}");
        }
        WebviewLogLevel::Info => {
            tracing::info!(target: "webview", module, fields, "{message}");
        }
        WebviewLogLevel::Warn => {
            tracing::warn!(target: "webview", module, fields, "{message}");
        }
        WebviewLogLevel::Error => {
            tracing::error!(target: "webview", module, fields, "{message}");
        }
    }
}

/// The structured payload as one JSON object, or empty when there is none,
/// so a line without context stays short.
fn render_fields(fields: Option<Map<String, Value>>) -> String {
    fields
        .filter(|fields| !fields.is_empty())
        .map(|fields| Value::Object(fields).to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_fields_is_json_or_empty() {
        assert_eq!(render_fields(None), "");
        assert_eq!(render_fields(Some(Map::new())), "");
        let mut fields = Map::new();
        fields.insert("notes".to_string(), Value::from(2561));
        fields.insert("path".to_string(), Value::from("daily/2026-10-11.md"));
        assert_eq!(
            render_fields(Some(fields)),
            r#"{"notes":2561,"path":"daily/2026-10-11.md"}"#
        );
    }

    #[test]
    fn webview_levels_deserialize_lowercase() {
        let level: WebviewLogLevel = serde_json::from_str("\"warn\"").expect("parses");
        assert!(matches!(level, WebviewLogLevel::Warn));
        assert!(serde_json::from_str::<WebviewLogLevel>("\"WARN\"").is_err());
    }
}
