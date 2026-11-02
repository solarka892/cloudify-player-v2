//! The `Client`: one per app, cloned into every Tauri command.

use std::fmt;
use std::sync::{Arc, PoisonError, RwLock, RwLockReadGuard, RwLockWriteGuard};
use std::time::Duration;

use url::Url;

use crate::auth::Token;
use crate::client_id::ClientIdCache;
use crate::error::{Error, Result};

const API_BASE: &str = "https://api-v2.soundcloud.com";
const WEB_BASE: &str = "https://soundcloud.com";

/// A current desktop Chrome. SoundCloud treats bot-looking user agents
/// differently, so the client introduces itself as a browser.
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
    AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const TIMEOUT: Duration = Duration::from_secs(30);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Talks to SoundCloud. Cheap to clone: clones share the connection pool, the
/// `client_id` and the session.
#[derive(Clone)]
pub struct Client {
    pub(crate) inner: Arc<Inner>,
}

pub(crate) struct Inner {
    pub(crate) http: reqwest::Client,
    /// Never follows redirects: a short link's target is read from its
    /// `Location` and checked before anything is sent there.
    pub(crate) no_redirects: reqwest::Client,
    pub(crate) api_base: Url,
    pub(crate) web_base: Url,
    pub(crate) client_id: ClientIdCache,
    session: RwLock<Session>,
}

/// The token, and what was learnt with it. `generation` changes with every
/// token change, so an answer that arrives after a sign-out or an account
/// switch is not filed under the new session.
#[derive(Default)]
struct Session {
    token: Option<Token>,
    generation: u64,
    my_id: Option<u64>,
}

impl Client {
    /// A client for the real SoundCloud, signed out.
    pub fn new() -> Result<Self> {
        Self::builder().build()
    }

    pub fn builder() -> ClientBuilder {
        ClientBuilder::default()
    }

    /// Signs in. The id cached for the previous session, if any, is dropped.
    pub fn set_token(&self, token: Token) {
        let mut session = self.session_mut();
        if session.token.as_ref() != Some(&token) {
            session.token = Some(token);
            session.generation += 1;
            session.my_id = None;
        }
    }

    /// Signs out (locally: SoundCloud has no route to revoke the token).
    pub fn clear_token(&self) {
        let mut session = self.session_mut();
        if session.token.is_some() {
            session.token = None;
            session.generation += 1;
            session.my_id = None;
        }
    }

    pub fn is_signed_in(&self) -> bool {
        self.session().token.is_some()
    }

    /// Looks up the `client_id` now rather than on the first real request, so
    /// a broken connection shows up at start-up.
    pub async fn warm_up(&self) -> Result<()> {
        let inner = &self.inner;
        inner
            .client_id
            .get(&inner.http, &inner.web_base)
            .await
            .map(drop)
    }

    pub(crate) fn token(&self) -> Option<Token> {
        self.session().token.clone()
    }

    /// The cached id of the signed-in user, and the session it belongs to.
    pub(crate) fn cached_my_id(&self) -> (u64, Option<u64>) {
        let session = self.session();
        (session.generation, session.my_id)
    }

    /// Files `id` under the session it was fetched with, unless that session
    /// has ended since.
    pub(crate) fn remember_my_id(&self, generation: u64, id: u64) {
        let mut session = self.session_mut();
        if session.generation == generation && session.token.is_some() {
            session.my_id = Some(id);
        }
    }

    /// An API URL: `path` on the API host, with `query`.
    pub(crate) fn api_url(&self, path: &str, query: &[(&str, &str)]) -> Url {
        let mut url = self.inner.api_base.clone();
        url.set_path(path);
        url.set_query(None);
        if !query.is_empty() {
            url.query_pairs_mut().extend_pairs(query);
        }
        url
    }

    // A poisoned lock only means another thread panicked mid-update of plain
    // data; the session is still usable, so recover instead of panicking too.
    fn session(&self) -> RwLockReadGuard<'_, Session> {
        self.inner
            .session
            .read()
            .unwrap_or_else(PoisonError::into_inner)
    }

    fn session_mut(&self) -> RwLockWriteGuard<'_, Session> {
        self.inner
            .session
            .write()
            .unwrap_or_else(PoisonError::into_inner)
    }
}

impl fmt::Debug for Client {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Client")
            .field("api_base", &self.inner.api_base.as_str())
            .field("web_base", &self.inner.web_base.as_str())
            .field("signed_in", &self.is_signed_in())
            .finish_non_exhaustive()
    }
}

/// Configures a [`Client`]. The defaults talk to the real SoundCloud; tests
/// point the two base URLs at local mock servers.
#[derive(Debug)]
pub struct ClientBuilder {
    api_base: Option<Url>,
    web_base: Option<Url>,
    user_agent: String,
    timeout: Duration,
    token: Option<Token>,
}

impl Default for ClientBuilder {
    fn default() -> Self {
        Self {
            api_base: None,
            web_base: None,
            user_agent: USER_AGENT.to_owned(),
            timeout: TIMEOUT,
            token: None,
        }
    }
}

impl ClientBuilder {
    /// Where api-v2 lives (`https://api-v2.soundcloud.com`). Only the origin
    /// is used. The session token is sent to this origin and no other.
    pub fn api_base(mut self, url: Url) -> Self {
        self.api_base = Some(url);
        self
    }

    /// Where the website lives (`https://soundcloud.com`): the `client_id` is
    /// read from its page, and writes carry it as `Origin`.
    pub fn web_base(mut self, url: Url) -> Self {
        self.web_base = Some(url);
        self
    }

    pub fn user_agent(mut self, user_agent: impl Into<String>) -> Self {
        self.user_agent = user_agent.into();
        self
    }

    /// The limit for one whole request, body included.
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Starts signed in.
    pub fn token(mut self, token: Token) -> Self {
        self.token = Some(token);
        self
    }

    pub fn build(self) -> Result<Client> {
        let api_base = origin(self.api_base, API_BASE)?;
        let web_base = origin(self.web_base, WEB_BASE)?;
        let http_client = || {
            reqwest::Client::builder()
                .user_agent(self.user_agent.as_str())
                .timeout(self.timeout)
                .connect_timeout(CONNECT_TIMEOUT.min(self.timeout))
        };
        let http = http_client().build().map_err(Error::network)?;
        let no_redirects = http_client()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(Error::network)?;
        let session = Session {
            token: self.token,
            ..Session::default()
        };
        Ok(Client {
            inner: Arc::new(Inner {
                http,
                no_redirects,
                api_base,
                web_base,
                client_id: ClientIdCache::default(),
                session: RwLock::new(session),
            }),
        })
    }
}

/// The root of `url` (or of `default`): every path is built from there.
fn origin(url: Option<Url>, default: &str) -> Result<Url> {
    let url = match url {
        Some(url) => url,
        None => Url::parse(default).map_err(|_| Error::invalid("bad default base URL"))?,
    };
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(Error::invalid("a base URL must be http(s) with a host"));
    }
    let mut root = url;
    root.set_path("/");
    root.set_query(None);
    root.set_fragment(None);
    Ok(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn token(value: &str) -> Token {
        Token::new(value).unwrap()
    }

    #[test]
    fn the_client_can_be_shared_across_tasks() {
        fn assert_shareable<T: Send + Sync + Clone + 'static>() {}
        assert_shareable::<Client>();
    }

    /// Tauri runs commands on a thread pool, so every future must be `Send`.
    /// Building the futures is enough; they are never polled.
    #[test]
    fn futures_can_move_between_threads() {
        fn assert_send<T: Send>(_: &T) {}
        let client = Client::new().unwrap();
        let filters = crate::TrackFilters::default();
        assert_send(&client.warm_up());
        assert_send(&client.resolve("x"));
        assert_send(&client.track(1));
        assert_send(&client.tracks(&[1, 2]));
        assert_send(&client.stream(1));
        assert_send(&client.playlist(1));
        assert_send(&client.search_tracks("x", &filters, crate::OffsetRequest::default()));
        assert_send(&client.user_liked_tracks(1, crate::PageRequest::default()));
        assert_send(&client.me());
        assert_send(&client.feed(crate::PageRequest::default()));
        assert_send(&client.like_track(1));
        assert_send(&client.mixed_selections(6));
    }

    #[test]
    fn a_new_token_forgets_the_old_users_id() {
        let client = Client::builder().token(token("first")).build().unwrap();
        let (generation, cached) = client.cached_my_id();
        assert_eq!(cached, None);
        client.remember_my_id(generation, 42);
        assert_eq!(client.cached_my_id().1, Some(42));

        client.set_token(token("first"));
        assert_eq!(client.cached_my_id().1, Some(42), "same token, same user");

        client.set_token(token("second"));
        assert_eq!(client.cached_my_id().1, None);

        client.clear_token();
        assert!(!client.is_signed_in());
    }

    #[test]
    fn an_answer_for_an_ended_session_is_not_kept() {
        let client = Client::builder().token(token("first")).build().unwrap();
        let (generation, _) = client.cached_my_id();
        client.set_token(token("second"));
        client.remember_my_id(generation, 42);
        assert_eq!(client.cached_my_id().1, None);
    }

    #[test]
    fn debug_shows_no_secrets() {
        let client = Client::builder().token(token("2-SECRET")).build().unwrap();
        let printed = format!("{client:?}");
        assert!(!printed.contains("SECRET"));
        assert!(printed.contains("signed_in: true"));
    }

    #[test]
    fn base_urls_are_reduced_to_their_origin() {
        let client = Client::builder()
            .api_base(Url::parse("http://127.0.0.1:9000/ignored?x=1").unwrap())
            .build()
            .unwrap();
        let url = client.api_url("/users/1/tracks", &[("limit", "5")]);
        assert_eq!(url.as_str(), "http://127.0.0.1:9000/users/1/tracks?limit=5");

        let bad = Client::builder()
            .web_base(Url::parse("file:///tmp/x").unwrap())
            .build()
            .unwrap_err();
        assert_eq!(bad.kind(), crate::ErrorKind::InvalidInput);
    }
}
