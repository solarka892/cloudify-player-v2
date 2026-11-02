use crate::client::Client;
use crate::error::Result;
use crate::http::Kind;
use crate::model::{Playlist, Track, restore_order};
use crate::raw;

impl Client {
    /// A playlist or album with every track, complete and in order.
    pub async fn playlist(&self, id: u64) -> Result<Playlist> {
        let url = self.api_url(&format!("/playlists/{id}"), &[("representation", "full")]);
        let raw: raw::Playlist = self.get_json(url, Kind::Read).await?;
        self.hydrate(raw).await
    }

    /// Only the first few tracks of a playlist arrive whole (5 of 479 in one
    /// measurement); the rest are stubs. Fills those in with `/tracks?ids=`
    /// and puts everything back in the playlist's order.
    pub(crate) async fn hydrate(&self, raw: raw::Playlist) -> Result<Playlist> {
        let (mut playlist, entries) = Playlist::split(raw);
        let order: Vec<u64> = entries.iter().map(|track| track.id).collect();
        let (complete, stubs): (Vec<raw::Track>, Vec<raw::Track>) =
            entries.into_iter().partition(raw::Track::is_complete);

        let mut tracks: Vec<Track> = complete.into_iter().map(Track::from_raw).collect();
        if !stubs.is_empty() {
            let ids: Vec<u64> = stubs.iter().map(|track| track.id).collect();
            tracks.extend(self.tracks(&ids).await?);
        }
        playlist.tracks = Some(restore_order(&order, tracks));
        Ok(playlist)
    }
}
