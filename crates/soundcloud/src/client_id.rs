//! The `client_id`: the key every api-v2 request needs.
//!
//! SoundCloud has issued none since 2015, so it is read the way the website
//! gets it — out of the script bundles soundcloud.com loads. It rotates, so it
//! lives only in memory, for a day at most.

use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};

use regex::Regex;
use tokio::sync::Mutex;
use url::Url;

use crate::error::{Error, ErrorKind, Result};
use crate::http;
use crate::links;

/// How long a discovered key is trusted before it is looked up again.
const TTL: Duration = Duration::from_secs(24 * 60 * 60);

/// After a refused key was re-discovered and came back unchanged, the next
/// refusals within this window are about something else (usually a dead
/// session) — looking again would only hammer soundcloud.com.
const RECHECK_AFTER: Duration = Duration::from_secs(10 * 60);

/// A failed discovery is handed to everyone who was queued behind it instead
/// of each of them retrying (and each waiting out its own timeout).
const FAILURE_HOLD: Duration = Duration::from_secs(3);

/// The bundle holding the key is large (~800 KB gzipped); a slow connection
/// should not fail the whole lookup on the usual request timeout.
const BUNDLE_TIMEOUT: Duration = Duration::from_secs(90);

/// `<script ... src="...">`, in document order.
static SCRIPT_SRC: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)<script\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']"#).expect("valid regex")
});

/// `client_id:"…"` or `client_id="…"` with a run of 20+ letters and digits
/// (32 in practice). Requiring the closing quote right after the run skips
/// other `client_id`s in the bundle, such as Google's `123.apps.googleusercontent.com`.
static CLIENT_ID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"client_id\s*[:=]\s*["']([A-Za-z0-9]{20,})["']"#).expect("valid regex")
});

/// The cache, shared by every clone of the `Client`.
///
/// One async mutex makes discovery single-flight: callers that arrive while a
/// lookup runs wait for it and take its result.
#[derive(Default)]
pub(crate) struct ClientIdCache {
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    current: Option<Key>,
    failure: Option<(Instant, Error)>,
}

struct Key {
    value: Arc<str>,
    found_at: Instant,
    /// When a refresh last found this same key again.
    confirmed_at: Option<Instant>,
}

impl Key {
    fn is_fresh(&self) -> bool {
        is_fresh(self.found_at.elapsed())
    }

    fn recently_confirmed(&self) -> bool {
        self.confirmed_at
            .is_some_and(|at| at.elapsed() < RECHECK_AFTER)
    }
}

fn is_fresh(age: Duration) -> bool {
    age < TTL
}

impl ClientIdCache {
    /// The current key, discovering one when there is none or it is a day old.
    pub(crate) async fn get(&self, http: &reqwest::Client, page: &Url) -> Result<Arc<str>> {
        let mut state = self.state.lock().await;
        if let Some(key) = &state.current
            && key.is_fresh()
        {
            return Ok(key.value.clone());
        }
        state.discover(http, page).await
    }

    /// A replacement for `stale`, which SoundCloud just refused.
    ///
    /// Returns `stale` itself when discovery finds the same key again — the
    /// caller then knows a retry would be pointless.
    pub(crate) async fn refresh(
        &self,
        http: &reqwest::Client,
        page: &Url,
        stale: &str,
    ) -> Result<Arc<str>> {
        let mut state = self.state.lock().await;
        if let Some(key) = &state.current {
            let replaced_meanwhile = &*key.value != stale && key.is_fresh();
            let just_checked = &*key.value == stale && key.recently_confirmed();
            if replaced_meanwhile || just_checked {
                return Ok(key.value.clone());
            }
        }
        state.discover(http, page).await
    }
}

impl State {
    async fn discover(&mut self, http: &reqwest::Client, page: &Url) -> Result<Arc<str>> {
        if let Some((at, error)) = &self.failure
            && at.elapsed() < FAILURE_HOLD
        {
            return Err(error.clone());
        }
        match discover(http, page).await {
            Ok(value) => {
                let now = Instant::now();
                let same = self.current.as_ref().is_some_and(|key| key.value == value);
                self.current = Some(Key {
                    value: value.clone(),
                    found_at: now,
                    confirmed_at: same.then_some(now),
                });
                self.failure = None;
                Ok(value)
            }
            Err(error) => {
                self.failure = Some((Instant::now(), error.clone()));
                Err(error)
            }
        }
    }
}

/// Reads soundcloud.com, then its script bundles from last to first (the key
/// is usually in one of the last), until one holds the key.
async fn discover(http: &reqwest::Client, page: &Url) -> Result<Arc<str>> {
    tracing::debug!("discovering a client_id");
    let html = fetch(http, page.clone(), "text/html", None).await?;
    let scripts = script_urls(&String::from_utf8_lossy(&html), page);
    if scripts.is_empty() {
        return Err(Error::ClientId("soundcloud.com listed no scripts".into()));
    }
    for script in scripts.iter().rev() {
        match fetch(http, script.clone(), "*/*", Some(BUNDLE_TIMEOUT)).await {
            Ok(body) => {
                if let Some(key) = find_client_id(&String::from_utf8_lossy(&body)) {
                    tracing::info!("discovered a client_id");
                    return Ok(key.into());
                }
            }
            // Offline halfway through: no point trying the rest.
            Err(error) if error.kind() == ErrorKind::Network => return Err(error),
            // One broken bundle should not stop the search.
            Err(error) => tracing::debug!(%error, "skipping a script bundle"),
        }
    }
    Err(Error::ClientId(format!(
        "none of the {} scripts on soundcloud.com held one",
        scripts.len()
    )))
}

/// A plain GET with no key and no token: these hosts are not the API.
///
/// Refusals that say something to the user keep their kind; anything else
/// means the lookup itself is broken.
async fn fetch(
    http: &reqwest::Client,
    url: Url,
    accept: &str,
    timeout: Option<Duration>,
) -> Result<Vec<u8>> {
    http::fetch_plain(http, url, accept, timeout)
        .await
        .map_err(|error| match error.kind() {
            ErrorKind::Network | ErrorKind::BotFiltered | ErrorKind::RateLimited => error,
            _ => Error::ClientId(format!("soundcloud.com refused the lookup ({error})")),
        })
}

/// Script bundles worth reading, in the order the page lists them.
pub(crate) fn script_urls(html: &str, page: &Url) -> Vec<Url> {
    SCRIPT_SRC
        .captures_iter(html)
        .filter_map(|captures| page.join(&captures[1]).ok())
        .filter(|url| url.path().ends_with(".js") && links::is_script_host(url, page))
        .collect()
}

pub(crate) fn find_client_id(script: &str) -> Option<&str> {
    CLIENT_ID
        .captures(script)
        .and_then(|captures| captures.get(1))
        .map(|key| key.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Shaped like the real page: SoundCloud's own bundles mixed with a
    /// tracker and a consent-banner script from other hosts.
    const PAGE: &str = r#"<!DOCTYPE html><html><head>
        <script src="https://dwt.soundcloud.com/tags.js" async></script>
        <script crossorigin src="https://a-v2.sndcdn.com/assets/59-ac0a49ce.js"></script>
        <script>window.__sc_hydration = [];</script>
        <script src="https://cdn.cookielaw.org/consent/abc/otSDKStub.js" data-domain-script="x"></script>
        <SCRIPT CROSSORIGIN SRC='/assets/local-1.js'></SCRIPT>
        <script crossorigin src="https://a-v2.sndcdn.com/assets/55-83a3da9b.js"></script>
        <link rel="preload" href="https://a-v2.sndcdn.com/assets/not-a-script.js">
        <script data-src="https://a-v2.sndcdn.com/assets/lazy.js"></script>
        <script src="https://a-v2.sndcdn.com/assets/style.css"></script>
    </head></html>"#;

    #[test]
    fn lists_soundcloud_bundles_in_page_order() {
        let page = Url::parse("https://soundcloud.com/").unwrap();
        let found: Vec<String> = script_urls(PAGE, &page)
            .iter()
            .map(Url::to_string)
            .collect();
        assert_eq!(
            found,
            [
                "https://a-v2.sndcdn.com/assets/59-ac0a49ce.js",
                "https://soundcloud.com/assets/local-1.js",
                "https://a-v2.sndcdn.com/assets/55-83a3da9b.js",
            ]
        );
    }

    #[test]
    fn finds_the_key_and_skips_lookalikes() {
        let bundle = r#"a={client_id:"984739005367.apps.googleusercontent.com"},
            b={client_id:"com.soundcloud.services.siwa"},
            c=e.get("client_id"),
            d={env:"production",client_id:"vt2oQexBfFF8I9fidrzKADHEtcll3t3Q",x:1}"#;
        assert_eq!(
            find_client_id(bundle),
            Some("vt2oQexBfFF8I9fidrzKADHEtcll3t3Q")
        );
    }

    #[test]
    fn accepts_assignment_and_single_quotes() {
        assert_eq!(
            find_client_id("var client_id='ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';"),
            Some("ABCDEFGHIJKLMNOPQRSTUVWXYZ012345")
        );
    }

    #[test]
    fn short_runs_are_not_keys() {
        assert_eq!(find_client_id(r#"client_id:"short1234""#), None);
        assert_eq!(find_client_id("no key here"), None);
    }

    #[test]
    fn keys_expire_after_a_day() {
        assert!(is_fresh(Duration::from_secs(60)));
        assert!(is_fresh(TTL - Duration::from_secs(1)));
        assert!(!is_fresh(TTL));
    }
}
