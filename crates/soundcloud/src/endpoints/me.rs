//! The signed-in user's own data. Every call here needs a session and is
//! refused locally, without a request, when there is none.

use std::collections::HashSet;

use crate::client::Client;
use crate::error::Result;
use crate::http::Kind;
use crate::model::{FeedItem, Me, PlayedTrack, feed_item};
use crate::paging::{Page, PageRequest};
use crate::raw;

impl Client {
    /// The signed-in account. Also the way to check a token before storing
    /// it: a dead one fails here with `Unauthorized`.
    pub async fn me(&self) -> Result<Me> {
        let raw = self.fetch_me().await?;
        Ok(Me::from_raw(raw))
    }

    /// The signed-in user's numeric id, which write routes are keyed on.
    /// Fetched once per session.
    pub async fn my_user_id(&self) -> Result<u64> {
        match self.cached_my_id() {
            (_, Some(id)) => Ok(id),
            _ => Ok(self.fetch_me().await?.id),
        }
    }

    async fn fetch_me(&self) -> Result<raw::User> {
        let (generation, _) = self.cached_my_id();
        let raw: raw::User = self
            .get_json(self.api_url("/me", &[]), Kind::PrivateRead)
            .await?;
        self.remember_my_id(generation, raw.id);
        Ok(raw)
    }

    /// What the user played, latest first. SoundCloud lists a track once per
    /// play; each page keeps only its latest play.
    pub async fn play_history(&self, page: PageRequest) -> Result<Page<PlayedTrack>> {
        let mut page = self
            .page(
                "/me/play-history/tracks",
                &[],
                page,
                Kind::PrivateRead,
                PlayedTrack::from_raw,
            )
            .await?;
        keep_latest_plays(&mut page.items);
        Ok(page)
    }

    /// New posts and reposts from the people the user follows.
    pub async fn feed(&self, page: PageRequest) -> Result<Page<FeedItem>> {
        self.page("/stream", &[], page, Kind::PrivateRead, feed_item)
            .await
    }
}

/// Plays come newest first, so the first sighting of a track is its latest play.
fn keep_latest_plays(plays: &mut Vec<PlayedTrack>) {
    let mut seen = HashSet::new();
    plays.retain(|play| seen.insert(play.track.id));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Track;

    fn play(id: u64, at: &str) -> PlayedTrack {
        let raw: raw::Track =
            serde_json::from_value(serde_json::json!({ "id": id, "title": "t" })).unwrap();
        PlayedTrack {
            played_at: Some(at.into()),
            track: Track::from_raw(raw),
        }
    }

    #[test]
    fn history_keeps_each_tracks_latest_play() {
        let mut plays = vec![play(1, "c"), play(2, "b"), play(1, "a"), play(3, "a")];
        keep_latest_plays(&mut plays);
        let kept: Vec<(u64, &str)> = plays
            .iter()
            .map(|p| (p.track.id, p.played_at.as_deref().unwrap()))
            .collect();
        assert_eq!(kept, [(1, "c"), (2, "b"), (3, "a")]);
    }
}
