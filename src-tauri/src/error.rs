//! The one error type every command returns.

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// A refused command, serialized for the frontend as
/// `{ kind, message, status, retryAfterSecs }` — the same shape
/// `soundcloud::Error` already has, so the UI reads every error one way.
/// Mirrored by `ApiError` in `src/api/invoke.ts`.
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error(transparent)]
    SoundCloud(#[from] soundcloud::Error),
    /// The OS keychain refused to read, store or delete the session.
    #[error("keychain: {0}")]
    Keychain(String),
    /// A file of the app's own on this computer (the listening diary) could not be read or written.
    #[error("storage: {0}")]
    Storage(String),
    /// The app itself could not do it (a window would not open, sign-in already running).
    #[error("{0}")]
    App(String),
}

pub type CommandResult<T> = Result<T, CommandError>;

impl Serialize for CommandError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let (kind, message) = match self {
            Self::SoundCloud(error) => return error.serialize(serializer),
            Self::Keychain(message) => ("keychain", message),
            Self::Storage(message) => ("storage", message),
            Self::App(message) => ("app", message),
        };
        let mut out = serializer.serialize_struct("Error", 4)?;
        out.serialize_field("kind", kind)?;
        out.serialize_field("message", message)?;
        out.serialize_field("status", &None::<u16>)?;
        out.serialize_field("retryAfterSecs", &None::<u64>)?;
        out.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn every_error_has_the_frontends_shape() {
        let soundcloud =
            serde_json::to_value(CommandError::from(soundcloud::Error::Unauthorized)).unwrap();
        assert_eq!(soundcloud["kind"], "unauthorized");
        assert_eq!(soundcloud["status"], 401);

        assert_eq!(
            serde_json::to_value(CommandError::Keychain("denied".into())).unwrap(),
            json!({ "kind": "keychain", "message": "denied", "status": null, "retryAfterSecs": null })
        );
        assert_eq!(
            serde_json::to_value(CommandError::Storage("disk full".into())).unwrap(),
            json!({ "kind": "storage", "message": "disk full", "status": null, "retryAfterSecs": null })
        );
        assert_eq!(
            serde_json::to_value(CommandError::App("busy".into())).unwrap(),
            json!({ "kind": "app", "message": "busy", "status": null, "retryAfterSecs": null })
        );
    }
}
