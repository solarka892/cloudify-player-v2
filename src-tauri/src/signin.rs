//! Sign-in through SoundCloud's own page, in a window of its own.
//!
//! There is no OAuth flow for third parties: after the person signs in on
//! soundcloud.com, the site sets an `oauth_token` cookie, and that value is the
//! session. The window is a plain browser for soundcloud.com — it has no access
//! to the app's commands (no capability names it) — and its cookie store is
//! read from Rust, because the cookie is HttpOnly. The window is incognito, so
//! nothing of the session stays in it and switching accounts works.

use std::time::Duration;

use soundcloud::{Client, ErrorKind, Me, Token};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

use crate::error::{CommandError, CommandResult};
use crate::keychain;

pub const LABEL: &str = "signin";
const SIGN_IN_PAGE: &str = "https://soundcloud.com/signin";
const COOKIE: &str = "oauth_token";
/// Phones are sent to m.soundcloud.com, where the cookie is set host-only.
const HOSTS: [&str; 2] = ["https://soundcloud.com/", "https://m.soundcloud.com/"];
const POLL: Duration = Duration::from_millis(600);

/// A current Safari: Google and Apple sign-in refuse what looks like an embedded webview.
#[cfg(target_os = "macos")]
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
    AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

/// Opens the sign-in window. Only one at a time: a second request focuses it.
pub fn open(app: &AppHandle) -> CommandResult<()> {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.set_focus();
        return Err(CommandError::App("sign-in is already open".into()));
    }
    let page = Url::parse(SIGN_IN_PAGE).map_err(|error| CommandError::App(error.to_string()))?;
    let builder = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(page))
        .title("Вход в SoundCloud")
        .inner_size(480.0, 760.0)
        .min_inner_size(380.0, 560.0)
        .center()
        .incognito(true);
    #[cfg(target_os = "macos")]
    let builder = builder.user_agent(USER_AGENT);
    builder
        .build()
        .map(drop)
        .map_err(|error| CommandError::App(format!("the sign-in window did not open: {error}")))
}

/// Waits until the person has signed in (the session is checked with
/// SoundCloud, stored in the keychain and given to `client`) or has closed the
/// window (`None`).
///
/// Polls from an async command, never from the main thread: reading cookies
/// there deadlocks on Windows.
pub async fn wait(app: &AppHandle, client: &Client) -> CommandResult<Option<Me>> {
    let hosts: Vec<Url> = HOSTS
        .iter()
        .filter_map(|host| Url::parse(host).ok())
        .collect();
    // A cookie SoundCloud already refused (a stale session) is not tried twice.
    let mut refused: Option<String> = None;
    loop {
        tokio::time::sleep(POLL).await;
        let Some(window) = app.get_webview_window(LABEL) else {
            return Ok(None);
        };
        let found = hosts.iter().find_map(|host| {
            let cookies = window.cookies_for_url(host.clone()).ok()?;
            session_cookie(
                cookies
                    .iter()
                    .map(|cookie| (cookie.name(), cookie.value(), cookie.domain())),
            )
            .map(str::to_owned)
        });
        let Some(value) = found else { continue };
        if refused.as_deref() == Some(value.as_str()) {
            continue;
        }
        let Ok(token) = Token::new(&value) else {
            refused = Some(value);
            continue;
        };
        client.set_token(token.clone());
        match client.me().await {
            Ok(me) => {
                let stored = keychain::save(&token).await;
                let _ = window.close();
                if let Err(error) = stored {
                    // Signed in for this run only would surprise on the next start: say so now.
                    client.clear_token();
                    return Err(error);
                }
                return Ok(Some(me));
            }
            Err(error) if error.kind() == ErrorKind::Unauthorized => {
                client.clear_token();
                refused = Some(value);
            }
            Err(error) => {
                client.clear_token();
                let _ = window.close();
                return Err(error.into());
            }
        }
    }
}

/// The `oauth_token` among `(name, value, domain)` cookies, if one is set for
/// soundcloud.com or a subdomain of it. The cookies come from
/// `cookies_for_url` for a SoundCloud page, so one without a domain is a
/// host-only cookie of that page.
fn session_cookie<'a>(
    cookies: impl IntoIterator<Item = (&'a str, &'a str, Option<&'a str>)>,
) -> Option<&'a str> {
    cookies
        .into_iter()
        .find(|(name, value, domain)| {
            *name == COOKIE && !value.trim().is_empty() && domain.is_none_or(is_soundcloud)
        })
        .map(|(_, value, _)| value)
}

fn is_soundcloud(domain: &str) -> bool {
    let domain = domain.trim_start_matches('.').to_ascii_lowercase();
    domain == "soundcloud.com" || domain.ends_with(".soundcloud.com")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_session_on_soundclouds_own_domains() {
        for domain in [
            Some(".soundcloud.com"),
            Some("soundcloud.com"),
            Some("m.soundcloud.com"),
            None,
        ] {
            let cookies = [
                ("sc_anonymous_id", "x", domain),
                ("oauth_token", "2-1-2-abc", domain),
            ];
            assert_eq!(session_cookie(cookies), Some("2-1-2-abc"), "{domain:?}");
        }
    }

    #[test]
    fn ignores_lookalike_domains_and_empty_values() {
        for domain in [
            "evilsoundcloud.com",
            "soundcloud.com.evil.net",
            "soundcloud.co",
        ] {
            assert_eq!(
                session_cookie([("oauth_token", "2-1-2-abc", Some(domain))]),
                None,
                "{domain}"
            );
        }
        assert_eq!(
            session_cookie([("oauth_token", " ", Some(".soundcloud.com"))]),
            None
        );
        assert_eq!(
            session_cookie([("other", "2-1-2-abc", Some(".soundcloud.com"))]),
            None
        );
    }
}
