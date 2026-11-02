//! Which hosts get what. URLs reach this crate from payloads and from the
//! user, so every one is checked before anything is sent to it.

use url::Url;

use crate::error::{Error, Result};

/// The only host waveforms are fetched from; the URL comes out of a payload.
const WAVEFORM_HOST: &str = "wave.sndcdn.com";

/// Share links from the app (`on.soundcloud.com/<code>`). `/resolve` does not
/// know them; the host itself redirects to the full link.
const SHORT_LINK_HOST: &str = "on.soundcloud.com";

/// Same scheme, host and port: the test for "this is the API", which decides
/// where the session token may go.
pub(crate) fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str() == b.host_str()
        && a.port_or_known_default() == b.port_or_known_default()
}

/// Rewrites a link the user pasted into the one spelling `/resolve` accepts.
///
/// `/resolve` answers 404 for `www.` and `m.` hosts, a trailing slash or a
/// missing scheme, so all of those are normalised to
/// `https://soundcloud.com/<path>`. The query and fragment are dropped: they
/// only carry share tracking (`si`, `utm_*`) or a start time.
pub(crate) fn soundcloud_link(input: &str) -> Result<Url> {
    let text = input.trim();
    if text.is_empty() {
        return Err(Error::invalid("the link is empty"));
    }
    let with_scheme = if text.contains("://") {
        text.to_owned()
    } else {
        format!("https://{text}")
    };
    let url = Url::parse(&with_scheme).map_err(|_| Error::invalid("that is not a link"))?;
    if !matches!(url.scheme(), "http" | "https")
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(Error::invalid("not a SoundCloud link"));
    }
    let host = match url.host_str() {
        Some("soundcloud.com" | "www.soundcloud.com" | "m.soundcloud.com") => "soundcloud.com",
        Some(SHORT_LINK_HOST) => SHORT_LINK_HOST,
        _ => return Err(Error::invalid("not a SoundCloud link")),
    };
    let path = url.path().trim_end_matches('/');
    if path.is_empty() {
        return Err(Error::invalid(
            "the link points at SoundCloud itself, not at a track, user or playlist",
        ));
    }
    Url::parse(&format!("https://{host}{path}")).map_err(|_| Error::invalid("that is not a link"))
}

pub(crate) fn is_short_link(url: &Url) -> bool {
    url.host_str() == Some(SHORT_LINK_HOST)
}

/// Where a short link's redirect points, checked like a pasted link: it must
/// land on soundcloud.com itself (and not on another short link).
pub(crate) fn short_link_target(location: &str, short: &Url) -> Result<Url> {
    let target = short
        .join(location)
        .map_err(|_| Error::invalid("the short link points nowhere"))?;
    let link = soundcloud_link(target.as_str())?;
    if is_short_link(&link) {
        return Err(Error::invalid(
            "the short link points at another short link",
        ));
    }
    Ok(link)
}

pub(crate) fn is_waveform_url(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str() == Some(WAVEFORM_HOST) && url.port().is_none()
}

/// Script bundles worth reading for the `client_id`: SoundCloud's own asset
/// CDN, or the page's own host. The page also pulls in third-party scripts
/// (consent banners, trackers), and the app talks to nobody but SoundCloud.
pub(crate) fn is_script_host(script: &Url, page: &Url) -> bool {
    if !matches!(script.scheme(), "http" | "https") {
        return false;
    }
    match script.host_str() {
        Some(host) => {
            Some(host) == page.host_str() || host == "sndcdn.com" || host.ends_with(".sndcdn.com")
        }
        None => false,
    }
}

/// Signed stream URLs go straight to the webview; only web schemes make sense.
pub(crate) fn is_web_url(text: &str) -> bool {
    Url::parse(text).is_ok_and(|url| matches!(url.scheme(), "http" | "https"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(text: &str) -> Url {
        Url::parse(text).unwrap()
    }

    #[test]
    fn same_origin_needs_scheme_host_and_port() {
        let api = url("https://api-v2.soundcloud.com");
        assert!(same_origin(
            &url("https://api-v2.soundcloud.com/tracks/1?x=1"),
            &api
        ));
        assert!(same_origin(
            &url("https://api-v2.soundcloud.com:443/me"),
            &api
        ));
        assert!(!same_origin(&url("http://api-v2.soundcloud.com/me"), &api));
        assert!(!same_origin(
            &url("https://api-v2.soundcloud.com:8443/me"),
            &api
        ));
        assert!(!same_origin(
            &url("https://api-v2.soundcloud.com.evil.example/me"),
            &api
        ));
        assert!(!same_origin(
            &url("https://api-v2.soundcloud.com@evil.example/me"),
            &api
        ));
        assert!(!same_origin(
            &url("https://cf-media.sndcdn.com/a.mp3"),
            &api
        ));
    }

    #[test]
    fn links_are_normalised_to_what_resolve_accepts() {
        let cases = [
            (
                "https://soundcloud.com/forss/flickermood",
                "https://soundcloud.com/forss/flickermood",
            ),
            (
                "soundcloud.com/forss/flickermood",
                "https://soundcloud.com/forss/flickermood",
            ),
            (
                "http://www.soundcloud.com/forss/flickermood/",
                "https://soundcloud.com/forss/flickermood",
            ),
            (
                "https://m.soundcloud.com/forss",
                "https://soundcloud.com/forss",
            ),
            (
                " https://soundcloud.com/forss/flickermood?si=abc&utm_source=clipboard#t=1:00 ",
                "https://soundcloud.com/forss/flickermood",
            ),
            (
                "HTTPS://SoundCloud.com/forss/sets/soulhack",
                "https://soundcloud.com/forss/sets/soulhack",
            ),
            (
                "https://on.soundcloud.com/AbC123",
                "https://on.soundcloud.com/AbC123",
            ),
        ];
        for (input, expected) in cases {
            assert_eq!(
                soundcloud_link(input).unwrap().as_str(),
                expected,
                "{input}"
            );
        }
    }

    #[test]
    fn foreign_or_empty_links_are_refused() {
        for bad in [
            "",
            "https://example.com/forss",
            "https://soundcloud.com.evil.example/forss",
            "https://user@soundcloud.com/forss",
            "https://soundcloud.com:8080/forss",
            "ftp://soundcloud.com/forss",
            "javascript:alert(1)",
            "https://soundcloud.com/",
            "https://api-v2.soundcloud.com/tracks/1",
        ] {
            let err = soundcloud_link(bad).unwrap_err();
            assert_eq!(err.kind(), crate::ErrorKind::InvalidInput, "{bad}");
        }
    }

    #[test]
    fn short_links_lead_to_soundcloud_only() {
        let short = url("https://on.soundcloud.com/0zlyp3n9d1tl9utvJY");
        assert!(is_short_link(&short));
        assert!(!is_short_link(&url("https://soundcloud.com/forss")));
        let location = "https://soundcloud.com/forss/flickermood?ref=clipboard&p=i&c=1\
            &si=CE7D46A22CB04444BA0EC0AC2D7F8A2B&utm_source=clipboard";
        assert_eq!(
            short_link_target(location, &short).unwrap().as_str(),
            "https://soundcloud.com/forss/flickermood"
        );
        for bad in [
            "https://evil.example/x",
            "/another-code",
            "https://on.soundcloud.com/x",
        ] {
            let err = short_link_target(bad, &short).unwrap_err();
            assert_eq!(err.kind(), crate::ErrorKind::InvalidInput, "{bad}");
        }
    }

    #[test]
    fn waveforms_come_only_from_their_host() {
        assert!(is_waveform_url(&url(
            "https://wave.sndcdn.com/cWHNerOLlkUq_m.json"
        )));
        assert!(!is_waveform_url(&url(
            "http://wave.sndcdn.com/cWHNerOLlkUq_m.json"
        )));
        assert!(!is_waveform_url(&url(
            "https://wave.sndcdn.com.evil.example/x.json"
        )));
        assert!(!is_waveform_url(&url("https://api-v2.soundcloud.com/me")));
    }

    #[test]
    fn only_soundcloud_scripts_are_read() {
        let page = url("https://soundcloud.com/");
        assert!(is_script_host(
            &url("https://a-v2.sndcdn.com/assets/55-83a3da9b.js"),
            &page
        ));
        assert!(is_script_host(
            &url("https://soundcloud.com/assets/x.js"),
            &page
        ));
        assert!(!is_script_host(
            &url("https://cdn.cookielaw.org/otSDKStub.js"),
            &page
        ));
        assert!(!is_script_host(
            &url("https://dwt.soundcloud.com/tags.js"),
            &page
        ));
        assert!(!is_script_host(&url("https://evilsndcdn.com/x.js"), &page));
    }

    #[test]
    fn stream_urls_must_be_web_urls() {
        assert!(is_web_url("https://cf-media.sndcdn.com/a.128.mp3?Policy=x"));
        assert!(is_web_url("http://localhost:1234/a.m3u8"));
        assert!(!is_web_url("file:///etc/passwd"));
        assert!(!is_web_url("not a url"));
    }
}
