//! The two paging styles api-v2 uses. They are not interchangeable: lists
//! under `/users`, `/me` and `/stream` hand out a `next_href` to follow,
//! while search takes a numeric `offset`.

use serde::{Deserialize, Serialize};
use url::Url;

use crate::error::{Error, Result};
use crate::links;

/// The most items api-v2 hands out per page.
pub const MAX_LIMIT: u32 = 200;

pub(crate) fn clamp_limit(limit: Option<u32>) -> u32 {
    limit.unwrap_or(MAX_LIMIT).clamp(1, MAX_LIMIT)
}

/// Where to continue a list: SoundCloud's `next_href`, opaque to the frontend.
///
/// It travels through the frontend and back, so it is re-checked on use: it
/// must point at the API host, or the session token would follow it
/// somewhere else. The `client_id` SoundCloud sometimes embeds in it is
/// stripped on the way out and added back on use.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Cursor(String);

impl Cursor {
    pub(crate) fn from_next_href(href: &str, api_base: &Url) -> Option<Self> {
        let url = api_base.join(href).ok()?;
        if !links::same_origin(&url, api_base) {
            tracing::warn!(
                host = url.host_str(),
                "ignoring a next_href off the API host"
            );
            return None;
        }
        Some(Self(without_client_id(&url).into()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub(crate) fn to_url(&self, api_base: &Url) -> Result<Url> {
        let url = Url::parse(&self.0).map_err(|_| Error::invalid("the cursor is not a URL"))?;
        if !links::same_origin(&url, api_base) {
            return Err(Error::invalid(
                "the cursor does not point at the SoundCloud API",
            ));
        }
        Ok(url)
    }
}

/// A copy of `url` without any `client_id` query parameter.
pub(crate) fn without_client_id(url: &Url) -> Url {
    let kept: Vec<(String, String)> = url
        .query_pairs()
        .filter(|(name, _)| name != "client_id")
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect();
    let mut out = url.clone();
    if kept.is_empty() {
        out.set_query(None);
    } else {
        out.query_pairs_mut().clear().extend_pairs(kept);
    }
    out
}

/// One page of a cursor-paged list.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    pub items: Vec<T>,
    /// `None` on the last page.
    pub next: Option<Cursor>,
}

/// One page of search results.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPage<T> {
    pub items: Vec<T>,
    /// SoundCloud's estimate of all matches.
    pub total: Option<u64>,
    /// Pass back as [`OffsetRequest::offset`] for the next page; `None` at the end.
    pub next_offset: Option<u32>,
}

/// Which page of a cursor-paged list to fetch. The default is the first page
/// at the largest size.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PageRequest {
    /// Items per page, clamped to `1..=200`. Ignored with a cursor, which
    /// already carries its page size.
    pub limit: Option<u32>,
    /// Continue after an earlier page of the same list.
    pub cursor: Option<Cursor>,
}

impl PageRequest {
    pub fn first(limit: u32) -> Self {
        Self {
            limit: Some(limit),
            cursor: None,
        }
    }

    pub fn after(cursor: Cursor) -> Self {
        Self {
            limit: None,
            cursor: Some(cursor),
        }
    }
}

/// Which page of search results to fetch.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct OffsetRequest {
    pub offset: u32,
    /// Items per page, clamped to `1..=200`.
    pub limit: Option<u32>,
}

/// Search's `next_href` is only `…&offset=N`; the number is all the UI needs.
pub(crate) fn next_offset(next_href: Option<&str>, offset: u32, limit: u32) -> Option<u32> {
    let href = next_href?;
    let parsed = Url::parse(href).ok().and_then(|url| {
        url.query_pairs()
            .find(|(name, _)| name == "offset")
            .and_then(|(_, value)| value.parse().ok())
    });
    Some(parsed.unwrap_or_else(|| offset.saturating_add(limit)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn api() -> Url {
        Url::parse("https://api-v2.soundcloud.com").unwrap()
    }

    #[test]
    fn limits_are_clamped() {
        assert_eq!(clamp_limit(None), 200);
        assert_eq!(clamp_limit(Some(0)), 1);
        assert_eq!(clamp_limit(Some(50)), 50);
        assert_eq!(clamp_limit(Some(5000)), 200);
    }

    #[test]
    fn cursors_drop_the_embedded_client_id() {
        let href = "https://api-v2.soundcloud.com/tracks/293/comments?client_id=SECRETKEY&offset=3&threaded=0&limit=3";
        let cursor = Cursor::from_next_href(href, &api()).unwrap();
        assert!(!cursor.as_str().contains("client_id"));
        assert!(!cursor.as_str().contains("SECRETKEY"));
        assert!(cursor.as_str().contains("offset=3"));
        assert!(cursor.as_str().contains("threaded=0"));
    }

    #[test]
    fn cursor_offsets_survive_reencoding() {
        let href = "https://api-v2.soundcloud.com/users/183/tracks?offset=2012-06-12T11%3A26%3A04.000Z%2Ctracks%2C00000000000049437906&limit=3";
        let cursor = Cursor::from_next_href(href, &api()).unwrap();
        let url = cursor.to_url(&api()).unwrap();
        let offset = url.query_pairs().find(|(k, _)| k == "offset").unwrap().1;
        assert_eq!(
            offset,
            "2012-06-12T11:26:04.000Z,tracks,00000000000049437906"
        );
    }

    #[test]
    fn cursors_must_point_at_the_api() {
        let ok = Cursor("https://api-v2.soundcloud.com/users/1/followers?offset=9".into());
        assert!(ok.to_url(&api()).is_ok());
        for bad in [
            "https://evil.example/users/1/followers?offset=9",
            "http://api-v2.soundcloud.com/users/1/followers",
            "https://api-v2.soundcloud.com.evil.example/x",
            "https://api-v2.soundcloud.com@evil.example/x",
            "/users/1/followers",
            "javascript:alert(1)",
        ] {
            let err = Cursor(bad.into()).to_url(&api()).unwrap_err();
            assert_eq!(err.kind(), crate::ErrorKind::InvalidInput, "{bad}");
        }
    }

    #[test]
    fn search_offsets_come_from_next_href() {
        let href = "https://api-v2.soundcloud.com/search/tracks?query_urn=soundcloud%3Asearch%3Aabc&limit=50&offset=50&q=daft%20punk";
        assert_eq!(next_offset(Some(href), 0, 50), Some(50));
        assert_eq!(next_offset(None, 0, 50), None);
        assert_eq!(
            next_offset(Some("https://api-v2.soundcloud.com/search?q=x"), 20, 20),
            Some(40)
        );
    }

    #[test]
    fn requests_deserialize_from_partial_json() {
        let request: PageRequest = serde_json::from_str("{}").unwrap();
        assert_eq!(request, PageRequest::default());
        let request: PageRequest = serde_json::from_str(r#"{"cursor":"https://x/y"}"#).unwrap();
        assert_eq!(request.cursor.unwrap().as_str(), "https://x/y");
        let offset: OffsetRequest = serde_json::from_str(r#"{"limit":20}"#).unwrap();
        assert_eq!(
            offset,
            OffsetRequest {
                offset: 0,
                limit: Some(20)
            }
        );
    }
}
