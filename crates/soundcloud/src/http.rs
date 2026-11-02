//! Sending requests: the `client_id` on every API request, the session token
//! only where it belongs, and the one retry with a fresh key.

use std::time::Duration;

use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, HeaderMap, ORIGIN, REFERER};
use reqwest::{Method, StatusCode};
use serde::de::DeserializeOwned;
use url::Url;

use crate::auth::Token;
use crate::client::Client;
use crate::error::{self, Error, Result};
use crate::links;
use crate::paging;

/// What a request is, which decides its headers and how a refusal is read.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Kind {
    /// Public data; the token rides along when signed in, as on the website.
    Read,
    /// The user's own data. Refused locally, without a request, when signed out.
    PrivateRead,
    /// The second playback hop. A 403 here is a rights restriction, not a
    /// stale key, so it does not cost a `client_id` lookup.
    Playback,
    /// Like, follow, repost. Needs a session; carries `{}` (or it is a 415)
    /// and the website's `Origin`/`Referer`.
    Write,
}

struct Reply {
    status: StatusCode,
    headers: HeaderMap,
    body: Vec<u8>,
    token_sent: bool,
}

impl Client {
    pub(crate) async fn get_json<T: DeserializeOwned>(&self, url: Url, kind: Kind) -> Result<T> {
        let context = url.path().to_owned();
        let body = self.send(Method::GET, url, kind).await?;
        serde_json::from_slice(&body).map_err(|err| Error::decode(&context, &err))
    }

    pub(crate) async fn write(&self, method: Method, url: Url) -> Result<()> {
        self.send(method, url, Kind::Write).await.map(drop)
    }

    async fn send(&self, method: Method, url: Url, kind: Kind) -> Result<Vec<u8>> {
        let inner = &self.inner;
        // Callers check URLs that come from outside; this is the backstop
        // that keeps the key and the session from going anywhere else.
        if !links::same_origin(&url, &inner.api_base) {
            return Err(Error::invalid("not a SoundCloud API URL"));
        }
        let token = self.token();
        if matches!(kind, Kind::PrivateRead | Kind::Write) && token.is_none() {
            return Err(Error::SignInRequired);
        }
        let key = inner.client_id.get(&inner.http, &inner.web_base).await?;
        let mut reply = self
            .attempt(&method, &url, kind, &key, token.as_ref())
            .await?;
        if wants_fresh_key(reply.status, &reply.headers, kind) {
            tracing::info!(
                path = url.path(),
                status = reply.status.as_u16(),
                "request refused; checking the client_id"
            );
            let fresh = inner
                .client_id
                .refresh(&inner.http, &inner.web_base, &key)
                .await?;
            // The same key again means the refusal was about something else
            // (usually the session); asking twice would not change the answer.
            if fresh != key {
                reply = self
                    .attempt(&method, &url, kind, &fresh, token.as_ref())
                    .await?;
            }
        }
        if reply.status.is_success() {
            return Ok(reply.body);
        }
        Err(error::from_reply(
            reply.status,
            &reply.headers,
            &reply.body,
            reply.token_sent,
        ))
    }

    async fn attempt(
        &self,
        method: &Method,
        url: &Url,
        kind: Kind,
        key: &str,
        token: Option<&Token>,
    ) -> Result<Reply> {
        let inner = &self.inner;
        let mut target = paging::without_client_id(url);
        target.query_pairs_mut().append_pair("client_id", key);

        let mut request = inner
            .http
            .request(method.clone(), target)
            .header(ACCEPT, "application/json");
        // The rule that matters most: the token goes to the API host and
        // nowhere else, whatever URL a payload or a cursor brought in.
        let token = token.filter(|_| links::same_origin(url, &inner.api_base));
        if let Some(token) = token {
            request = request.header(AUTHORIZATION, token.header());
        }
        if kind == Kind::Write {
            let origin = inner.web_base.origin().ascii_serialization();
            request = request
                .header(CONTENT_TYPE, "application/json")
                .header(REFERER, format!("{origin}/"))
                .header(ORIGIN, origin)
                .body("{}");
        }

        tracing::debug!(%method, path = url.path(), "api request");
        let response = request.send().await.map_err(Error::network)?;
        let status = response.status();
        let headers = response.headers().clone();
        let body = response.bytes().await.map_err(Error::network)?;
        Ok(Reply {
            status,
            headers,
            body: body.into(),
            token_sent: token.is_some(),
        })
    }
}

/// A 401 can mean a rotated `client_id`, and so can a 403 — unless DataDome
/// sent it (nothing is wrong with the key then) or it came from playback
/// (a rights restriction).
fn wants_fresh_key(status: StatusCode, headers: &HeaderMap, kind: Kind) -> bool {
    match status {
        StatusCode::UNAUTHORIZED => true,
        StatusCode::FORBIDDEN => kind != Kind::Playback && !error::is_datadome(headers),
        _ => false,
    }
}

/// A GET to a host that is not the API (soundcloud.com, the script CDN, the
/// waveform host): no `client_id`, no token. `timeout` overrides the
/// client's for one slow download.
pub(crate) async fn fetch_plain(
    http: &reqwest::Client,
    url: Url,
    accept: &str,
    timeout: Option<Duration>,
) -> Result<Vec<u8>> {
    tracing::debug!(host = url.host_str(), path = url.path(), "plain request");
    let mut request = http.get(url).header(ACCEPT, accept);
    if let Some(timeout) = timeout {
        request = request.timeout(timeout);
    }
    let response = request.send().await.map_err(Error::network)?;
    let status = response.status();
    let headers = response.headers().clone();
    let body = response.bytes().await.map_err(Error::network)?;
    if status.is_success() {
        Ok(body.into())
    } else {
        Err(error::from_reply(status, &headers, &body, false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;

    fn datadome() -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("x-datadome", HeaderValue::from_static("protected"));
        headers
    }

    #[test]
    fn a_401_always_earns_one_fresh_key() {
        for kind in [Kind::Read, Kind::PrivateRead, Kind::Playback, Kind::Write] {
            assert!(wants_fresh_key(
                StatusCode::UNAUTHORIZED,
                &HeaderMap::new(),
                kind
            ));
        }
    }

    #[test]
    fn a_403_earns_one_unless_datadome_or_playback() {
        let plain = HeaderMap::new();
        assert!(wants_fresh_key(StatusCode::FORBIDDEN, &plain, Kind::Read));
        assert!(wants_fresh_key(StatusCode::FORBIDDEN, &plain, Kind::Write));
        assert!(!wants_fresh_key(
            StatusCode::FORBIDDEN,
            &plain,
            Kind::Playback
        ));
        assert!(!wants_fresh_key(
            StatusCode::FORBIDDEN,
            &datadome(),
            Kind::Write
        ));
        assert!(!wants_fresh_key(
            StatusCode::FORBIDDEN,
            &datadome(),
            Kind::Read
        ));
    }

    #[test]
    fn other_statuses_are_final() {
        for status in [
            StatusCode::NOT_FOUND,
            StatusCode::TOO_MANY_REQUESTS,
            StatusCode::OK,
        ] {
            assert!(!wants_fresh_key(status, &HeaderMap::new(), Kind::Read));
        }
    }
}
