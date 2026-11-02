//! Ways in that are not a search: radio stations and the home page.

use crate::client::Client;
use crate::error::Result;
use crate::http::Kind;
use crate::model::{Selection, Track, selection};
use crate::paging::clamp_limit;
use crate::raw;

impl Client {
    /// Radio from a track: about fifty tracks like it.
    pub async fn track_station(&self, track_id: u64, limit: u32) -> Result<Vec<Track>> {
        self.station(&format!("soundcloud:track-stations:{track_id}"), limit)
            .await
    }

    /// Radio from an artist.
    pub async fn artist_station(&self, user_id: u64, limit: u32) -> Result<Vec<Track>> {
        self.station(&format!("soundcloud:artist-stations:{user_id}"), limit)
            .await
    }

    /// Only the station's `/tracks` exists (the station object itself is a
    /// 404), it never pages, and it ignores `limit` — so the cut is made here.
    async fn station(&self, urn: &str, limit: u32) -> Result<Vec<Track>> {
        let limit = clamp_limit(Some(limit));
        let url = self.api_url(
            &format!("/stations/{urn}/tracks"),
            &[("limit", &limit.to_string())],
        );
        let raw: raw::Collection<raw::Track> = self.get_json(url, Kind::Read).await?;
        Ok(raw
            .collection
            .0
            .into_iter()
            .take(limit as usize)
            .map(Track::from_raw)
            .collect())
    }

    /// The website's home page: rows of playlists such as "Curated by
    /// SoundCloud". Rows of anything but playlists are left out.
    pub async fn mixed_selections(&self, limit: u32) -> Result<Vec<Selection>> {
        let limit = clamp_limit(Some(limit)).to_string();
        let url = self.api_url("/mixed-selections", &[("limit", &limit)]);
        let raw: raw::Collection<raw::Selection> = self.get_json(url, Kind::Read).await?;
        Ok(raw.collection.0.into_iter().filter_map(selection).collect())
    }
}
