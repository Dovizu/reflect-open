use serde::{Deserialize, Serialize};

/// A `UIKeyModifierFlags` member.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KeyModifier {
    Command,
    Shift,
    Alternate,
    Control,
}

/// The key equivalent of a `UIKeyCommand`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyEquivalent {
    /// One character, or a named key (`enter`, `escape`, `tab`, `delete`,
    /// `upArrow`, `downArrow`, `leftArrow`, `rightArrow`).
    pub input: String,
    pub modifiers: Vec<KeyModifier>,
}

/// A menu command: chosen from the menu bar or by its key equivalent, it is
/// reported back on the `menuCommand` event with its id.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandItem {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_equivalent: Option<KeyEquivalent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MenuItem {
    Command(CommandItem),
    /// Ends one group of items and starts the next.
    Separator,
}

/// The system's standard menu a section joins.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MenuPlacement {
    Application,
    File,
    Edit,
    View,
    Window,
    Help,
}

/// One menu's worth of items; with no placement, a new top-level menu titled `title`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuSection {
    pub title: String,
    pub placement: Option<MenuPlacement>,
    pub items: Vec<MenuItem>,
}

/// `set_menu`'s request: the whole app menu, replacing the previous one.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetMenuRequest {
    pub sections: Vec<MenuSection>,
}

/// One item of a context menu.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextMenuItem {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub destructive: Option<bool>,
}

/// `present_context_menu`'s request: the items, and where in the webview (in
/// CSS pixels, which are points there) the menu points at.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresentContextMenuRequest {
    pub items: Vec<ContextMenuItem>,
    pub x: f64,
    pub y: f64,
}

/// `present_context_menu`'s response: the chosen item, or `None` when the
/// menu was dismissed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextMenuChoice {
    pub id: Option<String>,
}
