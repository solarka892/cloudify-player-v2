use serde::{Deserialize, Serialize};

use super::artwork::is_default_avatar;
use super::text;
use crate::raw;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: u64,
    pub urn: String,
    pub username: String,
    pub full_name: Option<String>,
    pub permalink_url: Option<String>,
    /// `None` instead of SoundCloud's grey default picture, so the UI can draw
    /// its own placeholder.
    pub avatar_url: Option<String>,
    /// The profile header image.
    pub banner_url: Option<String>,
    pub description: Option<String>,
    pub city: Option<String>,
    pub country_code: Option<String>,
    pub followers_count: Option<u64>,
    pub followings_count: Option<u64>,
    pub track_count: Option<u64>,
    pub playlist_count: Option<u64>,
    pub likes_count: Option<u64>,
    pub verified: bool,
}

impl User {
    pub(crate) fn from_raw(raw: raw::User) -> Self {
        let banner_url = raw
            .visuals
            .and_then(|visuals| visuals.visuals)
            .and_then(|visuals| {
                visuals
                    .into_iter()
                    .find_map(|visual| text(visual.visual_url))
            });
        Self {
            id: raw.id,
            urn: raw
                .urn
                .unwrap_or_else(|| format!("soundcloud:users:{}", raw.id)),
            username: raw.username.unwrap_or_default(),
            full_name: text(raw.full_name),
            permalink_url: text(raw.permalink_url),
            avatar_url: text(raw.avatar_url).filter(|url| !is_default_avatar(url)),
            banner_url,
            description: text(raw.description),
            city: text(raw.city),
            country_code: text(raw.country_code),
            followers_count: raw.followers_count,
            followings_count: raw.followings_count,
            track_count: raw.track_count,
            playlist_count: raw.playlist_count,
            likes_count: raw.likes_count,
            verified: raw.verified.unwrap_or(false),
        }
    }
}

/// The signed-in account.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Me {
    pub user: User,
    pub plan: Plan,
}

/// The listener's subscription.
///
/// Believed to sit on `/me` as `consumer_subscription.product.id`; not yet
/// seen signed in, so an unexpected value is reported as `Other`, not guessed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Plan {
    Free,
    Go,
    GoPlus,
    Dj,
    Other,
}

impl Plan {
    fn from_product(id: Option<&str>) -> Self {
        match id {
            None | Some("") | Some("free") => Self::Free,
            Some("consumer-mid-tier") => Self::Go,
            Some("consumer-high-tier") => Self::GoPlus,
            Some("consumer-high-dj-tier") => Self::Dj,
            Some(_) => Self::Other,
        }
    }
}

impl Me {
    pub(crate) fn from_raw(mut raw: raw::User) -> Self {
        let product = raw
            .consumer_subscription
            .take()
            .and_then(|subscription| subscription.product)
            .and_then(|product| product.id);
        Self {
            plan: Plan::from_product(product.as_deref()),
            user: User::from_raw(raw),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(json: &str) -> raw::User {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn reads_the_profile() {
        let user = User::from_raw(raw(
            r#"{"id":183,"username":"Forss","full_name":"","city":null,
                "avatar_url":"https://a1.sndcdn.com/images/default_avatar_large.png",
                "visuals":{"visuals":[{"visual_url":"https://i1.sndcdn.com/visuals-183-original.jpg"}]},
                "verified":true,"followers_count":132112}"#,
        ));
        assert_eq!(user.urn, "soundcloud:users:183");
        assert_eq!(user.avatar_url, None);
        assert_eq!(user.full_name, None);
        assert_eq!(
            user.banner_url.as_deref(),
            Some("https://i1.sndcdn.com/visuals-183-original.jpg")
        );
        assert!(user.verified);
        assert_eq!(user.followers_count, Some(132_112));
    }

    #[test]
    fn plan_comes_from_the_consumer_subscription() {
        let cases = [
            (r#"{"id":1}"#, Plan::Free),
            (
                r#"{"id":1,"consumer_subscription":{"product":{"id":"consumer-high-tier"}}}"#,
                Plan::GoPlus,
            ),
            (
                r#"{"id":1,"consumer_subscription":{"product":{"id":"consumer-mid-tier"}}}"#,
                Plan::Go,
            ),
            (
                r#"{"id":1,"consumer_subscription":{"product":{"id":"consumer-high-dj-tier"}}}"#,
                Plan::Dj,
            ),
            (
                r#"{"id":1,"consumer_subscription":{"product":{"id":"something-new"}}}"#,
                Plan::Other,
            ),
            (r#"{"id":1,"consumer_subscription":null}"#, Plan::Free),
        ];
        for (json, plan) in cases {
            assert_eq!(Me::from_raw(raw(json)).plan, plan, "{json}");
        }
    }
}
