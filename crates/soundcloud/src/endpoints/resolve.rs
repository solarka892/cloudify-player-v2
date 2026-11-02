use reqwest::header::LOCATION;
use url::Url;

use crate::client::Client;
use crate::error::{self, Error, Result};
use crate::http::Kind;
use crate::links;
use crate::model::{Resource, Track, User};
use crate::raw;

impl Client {
    /// Opens a soundcloud.com link (including `on.soundcloud.com` short
    /// links): a track, a user, or a playlist with all its tracks.
    ///
    /// The link comes from the user, so its host is checked before anything
    /// is sent.
    pub async fn resolve(&self, link: &str) -> Result<Resource> {
        let mut link = links::soundcloud_link(link)?;
        if links::is_short_link(&link) {
            link = self.expand_short_link(link).await?;
        }
        let url = self.api_url("/resolve", &[("url", link.as_str())]);
        let value: serde_json::Value = self.get_json(url, Kind::Read).await?;
        let kind = value["kind"].as_str().unwrap_or_default().to_owned();
        let decode = |err: serde_json::Error| Error::decode("/resolve", &err);
        match kind.as_str() {
            "track" => Ok(Resource::Track(Track::from_raw(
                serde_json::from_value(value).map_err(decode)?,
            ))),
            "user" => Ok(Resource::User(User::from_raw(
                serde_json::from_value(value).map_err(decode)?,
            ))),
            "playlist" => {
                let raw: raw::Playlist = serde_json::from_value(value).map_err(decode)?;
                Ok(Resource::Playlist(self.hydrate(raw).await?))
            }
            "" => Err(Error::NotAvailable(
                "the link opens nothing this app can show".into(),
            )),
            other => Err(Error::NotAvailable(format!(
                "the link opens a {other}, which this app cannot show"
            ))),
        }
    }

    /// `/resolve` answers 404 for short links; the short-link host answers
    /// with a redirect to the full link. Only its `Location` is read — the
    /// redirect is not followed — and checked like a pasted link.
    async fn expand_short_link(&self, short: Url) -> Result<Url> {
        tracing::debug!(path = short.path(), "expanding a short link");
        let response = self
            .inner
            .no_redirects
            .get(short.clone())
            .send()
            .await
            .map_err(Error::network)?;
        let status = response.status();
        if status.is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| Error::Decode("a short-link redirect without a Location".into()))?;
            return links::short_link_target(location, &short);
        }
        if status.is_success() {
            return Err(Error::NotAvailable("the short link leads nowhere".into()));
        }
        let headers = response.headers().clone();
        let body = response.bytes().await.map_err(Error::network)?;
        Err(error::from_reply(status, &headers, &body, false))
    }
}
