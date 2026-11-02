use std::collections::HashSet;

use futures_util::{StreamExt, TryStreamExt, stream};

use crate::client::Client;
use crate::error::Result;
use crate::http::Kind;
use crate::model::{Comment, Track, restore_order};
use crate::paging::{Page, PageRequest};
use crate::raw;

/// `/tracks?ids=` takes at most 50 ids; 51 is a 400.
const IDS_PER_REQUEST: usize = 50;

/// Batches in flight at once when filling in a long playlist.
const PARALLEL_BATCHES: usize = 4;

impl Client {
    pub async fn track(&self, id: u64) -> Result<Track> {
        let url = self.api_url(&format!("/tracks/{id}"), &[]);
        let raw: raw::Track = self.get_json(url, Kind::Read).await?;
        Ok(Track::from_raw(raw))
    }

    /// Many tracks by id, in the order asked (repeats included). Ids
    /// SoundCloud no longer returns — deleted or private — drop out.
    pub async fn tracks(&self, ids: &[u64]) -> Result<Vec<Track>> {
        let mut seen = HashSet::new();
        let unique: Vec<u64> = ids.iter().copied().filter(|id| seen.insert(*id)).collect();
        // Owned batches: a future borrowing its batch from the closure argument
        // would not be `Send`, and Tauri needs every command future to be.
        let batches: Vec<String> = unique
            .chunks(IDS_PER_REQUEST)
            .map(|batch| {
                batch
                    .iter()
                    .map(u64::to_string)
                    .collect::<Vec<_>>()
                    .join(",")
            })
            .collect();
        let fetched: Vec<Vec<raw::Track>> = stream::iter(batches)
            .map(|batch| self.track_batch(batch))
            .buffered(PARALLEL_BATCHES)
            .try_collect()
            .await?;
        let fetched = fetched.into_iter().flatten().map(Track::from_raw).collect();
        Ok(restore_order(ids, fetched))
    }

    /// `ids` is comma-separated, at most [`IDS_PER_REQUEST`] of them.
    async fn track_batch(&self, ids: String) -> Result<Vec<raw::Track>> {
        let url = self.api_url("/tracks", &[("ids", &ids)]);
        // A bare JSON array, not the usual `{ collection }`.
        let tracks: raw::Lenient<raw::Track> = self.get_json(url, Kind::Read).await?;
        Ok(tracks.0)
    }

    /// Tracks like this one: what powers radio and autoplay.
    pub async fn related_tracks(&self, id: u64, page: PageRequest) -> Result<Page<Track>> {
        let path = format!("/tracks/{id}/related");
        self.page(&path, &[], page, Kind::Read, |raw| {
            Some(Track::from_raw(raw))
        })
        .await
    }

    /// Comments, newest first; timed ones carry their position in the track.
    pub async fn track_comments(&self, id: u64, page: PageRequest) -> Result<Page<Comment>> {
        let path = format!("/tracks/{id}/comments");
        let extra = [("threaded", "0"), ("filter_replies", "0")];
        self.page(&path, &extra, page, Kind::Read, |raw| {
            Some(Comment::from_raw(raw))
        })
        .await
    }
}
