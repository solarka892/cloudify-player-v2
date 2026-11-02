//! Likes, follows and reposts.
//!
//! Each needs a session, sends `{}` with the website's `Origin` (see
//! `http::Kind::Write`) and gets the usual single `client_id` retry. They sit
//! behind DataDome, which may refuse them anyway: that comes back as
//! `BotFiltered`, never as a dead session or a bad key.

use reqwest::Method;

use crate::client::Client;
use crate::error::Result;

impl Client {
    pub async fn like_track(&self, track_id: u64) -> Result<()> {
        self.on_my_list(Method::PUT, "track_likes", track_id).await
    }

    pub async fn unlike_track(&self, track_id: u64) -> Result<()> {
        self.on_my_list(Method::DELETE, "track_likes", track_id)
            .await
    }

    /// Likes a playlist or an album.
    pub async fn like_playlist(&self, playlist_id: u64) -> Result<()> {
        self.on_my_list(Method::PUT, "playlist_likes", playlist_id)
            .await
    }

    pub async fn unlike_playlist(&self, playlist_id: u64) -> Result<()> {
        self.on_my_list(Method::DELETE, "playlist_likes", playlist_id)
            .await
    }

    /// A `POST` — `PUT` is a 404 on this route.
    pub async fn follow(&self, user_id: u64) -> Result<()> {
        self.on_me(Method::POST, "followings", user_id).await
    }

    pub async fn unfollow(&self, user_id: u64) -> Result<()> {
        self.on_me(Method::DELETE, "followings", user_id).await
    }

    pub async fn repost_track(&self, track_id: u64) -> Result<()> {
        self.on_me(Method::PUT, "track_reposts", track_id).await
    }

    pub async fn unrepost_track(&self, track_id: u64) -> Result<()> {
        self.on_me(Method::DELETE, "track_reposts", track_id).await
    }

    pub async fn repost_playlist(&self, playlist_id: u64) -> Result<()> {
        self.on_me(Method::PUT, "playlist_reposts", playlist_id)
            .await
    }

    pub async fn unrepost_playlist(&self, playlist_id: u64) -> Result<()> {
        self.on_me(Method::DELETE, "playlist_reposts", playlist_id)
            .await
    }

    /// `/users/{me}/{list}/{id}`: likes are keyed on the user's numeric id.
    async fn on_my_list(&self, method: Method, list: &str, id: u64) -> Result<()> {
        let me = self.my_user_id().await?;
        let url = self.api_url(&format!("/users/{me}/{list}/{id}"), &[]);
        self.write(method, url).await
    }

    /// `/me/{list}/{id}`: follows and reposts.
    async fn on_me(&self, method: Method, list: &str, id: u64) -> Result<()> {
        let url = self.api_url(&format!("/me/{list}/{id}"), &[]);
        self.write(method, url).await
    }
}
