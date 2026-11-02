//! The signed-in session's token.

use std::fmt;
use std::sync::Arc;

use reqwest::header::HeaderValue;

use crate::error::{Error, Result};

/// The `oauth_token` cookie soundcloud.com sets after sign-in.
///
/// Deliberately has no `Display` and no `Serialize`, and its `Debug` prints
/// nothing of the value: a token that cannot be formatted cannot end up in a
/// log line or in a reply to the frontend by accident.
#[derive(Clone)]
pub struct Token {
    value: Arc<str>,
    header: HeaderValue,
}

impl Token {
    /// Accepts the cookie value as pasted, tolerating surrounding whitespace
    /// and the `OAuth ` prefix of a copied `Authorization` header.
    pub fn new(raw: &str) -> Result<Self> {
        let start = raw.trim_start();
        let value = strip_prefix_ignore_case(start, "OAuth ")
            .unwrap_or(start)
            .trim();
        if value.is_empty() {
            return Err(Error::invalid("the token is empty"));
        }
        if !value.bytes().all(|b| b.is_ascii_graphic()) {
            return Err(Error::invalid(
                "the token has characters a SoundCloud token never has",
            ));
        }
        let mut header = HeaderValue::from_str(&format!("OAuth {value}"))
            .map_err(|_| Error::invalid("the token cannot be sent as a header"))?;
        // Keeps it out of hyper's debug output and HTTP/2 header compression tables.
        header.set_sensitive(true);
        Ok(Self {
            value: value.into(),
            header,
        })
    }

    /// The raw value, for storing in the OS keyring. Never log it.
    pub fn expose(&self) -> &str {
        &self.value
    }

    pub(crate) fn header(&self) -> HeaderValue {
        self.header.clone()
    }
}

impl PartialEq for Token {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for Token {}

impl fmt::Debug for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Token(<redacted>)")
    }
}

fn strip_prefix_ignore_case<'a>(text: &'a str, prefix: &str) -> Option<&'a str> {
    let head = text.get(..prefix.len())?;
    head.eq_ignore_ascii_case(prefix)
        .then(|| &text[prefix.len()..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_never_shows_the_value() {
        let token = Token::new("2-292593-123456-AbCdEf").unwrap();
        let printed = format!("{token:?} {:?}", Some(&token));
        assert!(!printed.contains("AbCdEf"));
        assert!(printed.contains("redacted"));
    }

    #[test]
    fn accepts_a_pasted_cookie_or_header() {
        let plain = Token::new("  2-292593-123456-AbCdEf \n").unwrap();
        assert_eq!(plain.expose(), "2-292593-123456-AbCdEf");
        let header = Token::new("oauth 2-292593-123456-AbCdEf").unwrap();
        assert_eq!(header, plain);
        assert_eq!(plain.header(), "OAuth 2-292593-123456-AbCdEf");
        assert!(plain.header().is_sensitive());
    }

    #[test]
    fn rejects_what_cannot_be_a_token() {
        for bad in ["", "   ", "OAuth ", "two words", "tab\tinside", "ключ"] {
            let err = Token::new(bad).unwrap_err();
            assert_eq!(err.kind(), crate::ErrorKind::InvalidInput, "{bad:?}");
        }
    }
}
