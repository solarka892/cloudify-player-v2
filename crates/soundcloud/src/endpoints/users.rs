//! Public profiles: everything here works signed out.

use crate::client::Client;
use crate::error::Result;
use crate::http::Kind;
use crate::model::{LikedPlaylist, LikedTrack, Playlist, Repost, Track, User, repost};
use crate::paging::{Page, PageRequest};
use crate::raw;

impl Client {
    pub async fn user(&self, id: u64) -> Result<User> {
        let url = self.api_url(&format!("/users/{id}"), &[]);
        let raw: raw::User = self.get_json(url, Kind::Read).await?;
        Ok(User::from_raw(raw))
    }

    /// Uploads, newest first.
    pub async fn user_tracks(&self, id: u64, page: PageRequest) -> Result<Page<Track>> {
        self.track_list(&format!("/users/{id}/tracks"), page).await
    }

    /// Most played first.
    pub async fn user_top_tracks(&self, id: u64, page: PageRequest) -> Result<Page<Track>> {
        self.track_list(&format!("/users/{id}/toptracks"), page)
            .await
    }

    pub async fn user_albums(&self, id: u64, page: PageRequest) -> Result<Page<Playlist>> {
        self.playlist_list(&format!("/users/{id}/albums"), page)
            .await
    }

    /// Playlists without the albums, which have their own list
    /// (`/users/{id}/playlists` would show them twice).
    pub async fn user_playlists(&self, id: u64, page: PageRequest) -> Result<Page<Playlist>> {
        self.playlist_list(&format!("/users/{id}/playlists_without_albums"), page)
            .await
    }

    /// Liked tracks, most recent like first.
    pub async fn user_liked_tracks(&self, id: u64, page: PageRequest) -> Result<Page<LikedTrack>> {
        // `/likes` mixes track and playlist likes; the playlists have their own list.
        let path = format!("/users/{id}/likes");
        self.page(&path, &[], page, Kind::Read, LikedTrack::from_raw)
            .await
    }

    /// Liked playlists and albums, most recent like first.
    pub async fn user_liked_playlists(
        &self,
        id: u64,
        page: PageRequest,
    ) -> Result<Page<LikedPlaylist>> {
        let path = format!("/users/{id}/playlist_likes");
        self.page(&path, &[], page, Kind::Read, LikedPlaylist::from_raw)
            .await
    }

    /// Who this user follows.
    pub async fn user_followings(&self, id: u64, page: PageRequest) -> Result<Page<User>> {
        self.user_list(&format!("/users/{id}/followings"), page)
            .await
    }

    pub async fn user_followers(&self, id: u64, page: PageRequest) -> Result<Page<User>> {
        self.user_list(&format!("/users/{id}/followers"), page)
            .await
    }

    /// Tracks and playlists this user reposted.
    pub async fn user_reposts(&self, id: u64, page: PageRequest) -> Result<Page<Repost>> {
        let path = format!("/stream/users/{id}/reposts");
        self.page(&path, &[], page, Kind::Read, repost).await
    }

    /// "Fans also like".
    pub async fn related_artists(&self, id: u64, page: PageRequest) -> Result<Page<User>> {
        self.user_list(&format!("/users/{id}/relatedartists"), page)
            .await
    }

    async fn track_list(&self, path: &str, page: PageRequest) -> Result<Page<Track>> {
        self.page(path, &[], page, Kind::Read, |raw| {
            Some(Track::from_raw(raw))
        })
        .await
    }

    async fn playlist_list(&self, path: &str, page: PageRequest) -> Result<Page<Playlist>> {
        self.page(path, &[], page, Kind::Read, |raw| {
            Some(Playlist::from_raw(raw))
        })
        .await
    }

    async fn user_list(&self, path: &str, page: PageRequest) -> Result<Page<User>> {
        self.page(path, &[], page, Kind::Read, |raw| Some(User::from_raw(raw)))
            .await
    }
}
