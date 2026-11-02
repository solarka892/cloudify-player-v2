//! One error type for the whole crate.
//!
//! The UI never shows these messages: it switches on [`ErrorKind`] and says
//! something plain ("no connection", "sign in again", "SoundCloud's bot
//! protection refused this"). The message is for logs and bug reports, so it
//! must stay free of tokens and keys — nothing here ever formats a request URL
//! or a header.

use std::time::Duration;

use reqwest::StatusCode;
use reqwest::header::{HeaderMap, RETRY_AFTER};
use serde::ser::SerializeStruct;
use serde::{Deserialize, Serialize, Serializer};

pub type Result<T, E = Error> = std::result::Result<T, E>;

/// What went wrong, as a stable name the frontend can match on.
///
/// Serialized in kebab-case (`"bot-filtered"`); renaming a variant is a
/// breaking change for the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[non_exhaustive]
pub enum ErrorKind {
    /// SoundCloud could not be reached at all.
    Network,
    /// A token was sent and SoundCloud refused it: the session is over.
    Unauthorized,
    /// The call needs a signed-in session and there is none.
    SignInRequired,
    /// DataDome, the bot filter in front of SoundCloud, refused the request.
    /// Nothing is wrong with the key or the session.
    BotFiltered,
    /// SoundCloud refused access to this particular thing.
    Forbidden,
    NotFound,
    RateLimited,
    /// It exists, but this app cannot play or show it here (no playable
    /// stream, region or rights restrictions, an unsupported link).
    NotAvailable,
    /// No working `client_id` could be found on soundcloud.com.
    ClientId,
    /// The caller passed something unusable; nothing was sent.
    InvalidInput,
    /// SoundCloud answered in a shape this crate does not understand.
    Decode,
    /// Any other refusal; the status and a short body snippet are attached.
    Api,
}

/// Everything that can go wrong talking to SoundCloud.
///
/// `Clone` so a failed `client_id` discovery can be handed to every caller
/// that was waiting on it.
#[derive(Debug, Clone, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error("network error: {0}")]
    Network(String),
    #[error("SoundCloud refused the session (expired or revoked)")]
    Unauthorized,
    #[error("this needs a signed-in session")]
    SignInRequired,
    #[error("SoundCloud's bot protection (DataDome) refused the request")]
    BotFiltered,
    #[error("SoundCloud refused access")]
    Forbidden,
    #[error("not found on SoundCloud")]
    NotFound,
    #[error("SoundCloud is rate limiting this client")]
    RateLimited { retry_after: Option<Duration> },
    #[error("not available: {0}")]
    NotAvailable(String),
    #[error("no working client_id: {0}")]
    ClientId(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("unexpected reply: {0}")]
    Decode(String),
    #[error("SoundCloud answered {status}: {snippet}")]
    Api { status: u16, snippet: String },
}

impl Error {
    pub fn kind(&self) -> ErrorKind {
        match self {
            Self::Network(_) => ErrorKind::Network,
            Self::Unauthorized => ErrorKind::Unauthorized,
            Self::SignInRequired => ErrorKind::SignInRequired,
            Self::BotFiltered => ErrorKind::BotFiltered,
            Self::Forbidden => ErrorKind::Forbidden,
            Self::NotFound => ErrorKind::NotFound,
            Self::RateLimited { .. } => ErrorKind::RateLimited,
            Self::NotAvailable(_) => ErrorKind::NotAvailable,
            Self::ClientId(_) => ErrorKind::ClientId,
            Self::InvalidInput(_) => ErrorKind::InvalidInput,
            Self::Decode(_) => ErrorKind::Decode,
            Self::Api { .. } => ErrorKind::Api,
        }
    }

    /// The HTTP status behind the error, when one is known.
    pub fn status(&self) -> Option<u16> {
        match self {
            Self::Unauthorized => Some(401),
            Self::BotFiltered | Self::Forbidden => Some(403),
            Self::NotFound => Some(404),
            Self::RateLimited { .. } => Some(429),
            Self::Api { status, .. } => Some(*status),
            _ => None,
        }
    }

    /// How long SoundCloud asked us to wait, when it said.
    pub fn retry_after(&self) -> Option<Duration> {
        match self {
            Self::RateLimited { retry_after } => *retry_after,
            _ => None,
        }
    }

    /// Keeps the whole cause chain ("connection refused", "timed out") but
    /// drops the URL, which carries the `client_id`.
    pub(crate) fn network(err: reqwest::Error) -> Self {
        let err = err.without_url();
        let mut message = err.to_string();
        let mut source = std::error::Error::source(&err);
        while let Some(cause) = source {
            let text = cause.to_string();
            if !message.ends_with(&text) {
                message.push_str(": ");
                message.push_str(&text);
            }
            source = cause.source();
        }
        Self::Network(message)
    }

    /// `context` names what was being read (a route path, never a full URL).
    pub(crate) fn decode(context: &str, err: &serde_json::Error) -> Self {
        Self::Decode(format!("{context}: {err}"))
    }

    pub(crate) fn invalid(message: impl Into<String>) -> Self {
        Self::InvalidInput(message.into())
    }
}

/// Serialized for the frontend as `{ kind, message, status, retryAfterSecs }`.
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("Error", 4)?;
        out.serialize_field("kind", &self.kind())?;
        out.serialize_field("message", &self.to_string())?;
        out.serialize_field("status", &self.status())?;
        out.serialize_field("retryAfterSecs", &self.retry_after().map(|d| d.as_secs()))?;
        out.end()
    }
}

/// Turns a refused reply into an error, after the one `client_id` retry has
/// already been spent.
///
/// `token_sent` is what tells a dead session from a dead key: with no token,
/// a public route only says 401 when it does not accept the `client_id`.
pub(crate) fn from_reply(
    status: StatusCode,
    headers: &HeaderMap,
    body: &[u8],
    token_sent: bool,
) -> Error {
    match status.as_u16() {
        401 if token_sent => Error::Unauthorized,
        401 => Error::ClientId("SoundCloud refused a freshly discovered key".into()),
        403 if is_datadome(headers) => Error::BotFiltered,
        403 => Error::Forbidden,
        404 => Error::NotFound,
        429 => Error::RateLimited {
            retry_after: retry_after(headers),
        },
        code => Error::Api {
            status: code,
            snippet: snippet(body),
        },
    }
}

/// DataDome stamps `x-datadome` on what it guards, so the header alone is not
/// a refusal — only together with a 403.
pub(crate) fn is_datadome(headers: &HeaderMap) -> bool {
    headers.contains_key("x-datadome")
}

fn retry_after(headers: &HeaderMap) -> Option<Duration> {
    let value = headers.get(RETRY_AFTER)?.to_str().ok()?;
    value.trim().parse().ok().map(Duration::from_secs)
}

/// Enough of an error body to recognise it in a log, on one line.
fn snippet(body: &[u8]) -> String {
    const MAX_CHARS: usize = 200;
    let text = String::from_utf8_lossy(body);
    let mut words = text.split_whitespace();
    let mut out = String::new();
    let mut truncated = false;
    for word in words.by_ref() {
        if out.chars().count() + word.chars().count() + 1 > MAX_CHARS {
            truncated = true;
            break;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(word);
    }
    if truncated {
        out.push('…');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(*name, HeaderValue::from_static(value));
        }
        map
    }

    fn classify(status: u16, pairs: &[(&'static str, &'static str)], token: bool) -> Error {
        from_reply(
            StatusCode::from_u16(status).unwrap(),
            &headers(pairs),
            b"{}",
            token,
        )
    }

    #[test]
    fn a_refused_token_is_a_dead_session() {
        assert_eq!(classify(401, &[], true).kind(), ErrorKind::Unauthorized);
    }

    #[test]
    fn an_anonymous_401_blames_the_key() {
        assert_eq!(classify(401, &[], false).kind(), ErrorKind::ClientId);
    }

    #[test]
    fn datadome_is_told_apart_from_a_plain_403() {
        let dd = classify(403, &[("x-datadome", "protected")], true);
        assert_eq!(dd.kind(), ErrorKind::BotFiltered);
        assert_eq!(classify(403, &[], true).kind(), ErrorKind::Forbidden);
    }

    #[test]
    fn datadome_header_on_other_statuses_is_not_a_refusal() {
        let kind = classify(404, &[("x-datadome", "protected")], false).kind();
        assert_eq!(kind, ErrorKind::NotFound);
    }

    #[test]
    fn rate_limit_keeps_the_wait() {
        let err = classify(429, &[("retry-after", "30")], false);
        assert_eq!(err.kind(), ErrorKind::RateLimited);
        assert_eq!(err.retry_after(), Some(Duration::from_secs(30)));
        let undated = classify(
            429,
            &[("retry-after", "Wed, 21 Oct 2015 07:28:00 GMT")],
            false,
        );
        assert_eq!(undated.retry_after(), None);
    }

    #[test]
    fn other_statuses_carry_a_snippet() {
        let err = from_reply(
            StatusCode::UNPROCESSABLE_ENTITY,
            &HeaderMap::new(),
            b"{\"error\":\n   \"bad shape\"}",
            true,
        );
        match err {
            Error::Api { status, snippet } => {
                assert_eq!(status, 422);
                assert_eq!(snippet, "{\"error\": \"bad shape\"}");
            }
            other => panic!("expected Api, got {other:?}"),
        }
    }

    #[test]
    fn snippets_stay_short() {
        let long = "word ".repeat(200);
        let cut = snippet(long.as_bytes());
        assert!(cut.chars().count() <= 201);
        assert!(cut.ends_with('…'));
    }

    #[test]
    fn serializes_for_the_frontend() {
        let json = serde_json::to_value(Error::BotFiltered).unwrap();
        assert_eq!(json["kind"], "bot-filtered");
        assert_eq!(json["status"], 403);
        assert!(json["message"].as_str().unwrap().contains("DataDome"));

        let kinds = [
            (ErrorKind::SignInRequired, "sign-in-required"),
            (ErrorKind::NotAvailable, "not-available"),
            (ErrorKind::ClientId, "client-id"),
            (ErrorKind::InvalidInput, "invalid-input"),
        ];
        for (kind, name) in kinds {
            assert_eq!(serde_json::to_value(kind).unwrap(), name);
        }
    }
}
