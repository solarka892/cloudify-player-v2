use std::str::FromStr;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::client::Client;
use crate::error::{Error, Result};
use crate::http::Kind;
use crate::model::{Playlist, Resource, Suggestion, Track, User};
use crate::paging::{OffsetRequest, SearchPage, clamp_limit, next_offset};
use crate::raw;

/// Narrows a track search, as the website's filter panel does.
///
/// SoundCloud answers an unknown filter value with a 400 (and an unknown
/// genre with nothing at all), so every value here is one it accepts.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct TrackFilters {
    /// A genre name in any case (`House`, `deep house`). SoundCloud matches
    /// only the lowercase spelling, so it is sent lowercased.
    pub genre: Option<String>,
    pub duration: Option<DurationFilter>,
    pub created: Option<CreatedWithin>,
    pub license: Option<LicenseFilter>,
    /// Only Go+ tracks — what the website's Go+ tab adds.
    pub go_plus_only: bool,
}

/// Length bands: under 2 minutes, 2–10, 10–30, over 30.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DurationFilter {
    Short,
    Medium,
    Long,
    Epic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CreatedWithin {
    LastHour,
    LastDay,
    LastWeek,
    LastMonth,
    LastYear,
}

/// What the licence allows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LicenseFilter {
    ToShare,
    ToModifyCommercially,
    ToUseCommercially,
}

/// The query-string spelling of a filter value, and parsing it back.
trait FilterValue: Sized + Copy + 'static {
    const NAME: &'static str;
    const ALL: &'static [Self];
    fn api_value(self) -> &'static str;

    /// Accepts the API spelling (`last_week`) or the JSON one (`last-week`).
    fn parse(text: &str) -> Result<Self> {
        let wanted = text.trim().to_ascii_lowercase().replace('-', "_");
        Self::ALL
            .iter()
            .copied()
            .find(|value| value.api_value() == wanted)
            .ok_or_else(|| Error::invalid(format!("unknown {} filter: {text:?}", Self::NAME)))
    }
}

impl FilterValue for DurationFilter {
    const NAME: &'static str = "duration";
    const ALL: &'static [Self] = &[Self::Short, Self::Medium, Self::Long, Self::Epic];
    fn api_value(self) -> &'static str {
        match self {
            Self::Short => "short",
            Self::Medium => "medium",
            Self::Long => "long",
            Self::Epic => "epic",
        }
    }
}

impl FilterValue for CreatedWithin {
    const NAME: &'static str = "created";
    const ALL: &'static [Self] = &[
        Self::LastHour,
        Self::LastDay,
        Self::LastWeek,
        Self::LastMonth,
        Self::LastYear,
    ];
    fn api_value(self) -> &'static str {
        match self {
            Self::LastHour => "last_hour",
            Self::LastDay => "last_day",
            Self::LastWeek => "last_week",
            Self::LastMonth => "last_month",
            Self::LastYear => "last_year",
        }
    }
}

impl FilterValue for LicenseFilter {
    const NAME: &'static str = "license";
    const ALL: &'static [Self] = &[
        Self::ToShare,
        Self::ToModifyCommercially,
        Self::ToUseCommercially,
    ];
    fn api_value(self) -> &'static str {
        match self {
            Self::ToShare => "to_share",
            Self::ToModifyCommercially => "to_modify_commercially",
            Self::ToUseCommercially => "to_use_commercially",
        }
    }
}

macro_rules! from_str_via_filter_value {
    ($($ty:ty),*) => {$(
        impl FromStr for $ty {
            type Err = Error;
            fn from_str(text: &str) -> Result<Self> {
                <$ty as FilterValue>::parse(text)
            }
        }
    )*};
}

from_str_via_filter_value!(DurationFilter, CreatedWithin, LicenseFilter);

impl TrackFilters {
    /// The `filter.*` query parameters.
    pub(crate) fn query(&self) -> Vec<(&'static str, String)> {
        let mut query = Vec::new();
        if let Some(genre) = self
            .genre
            .as_deref()
            .map(str::trim)
            .filter(|g| !g.is_empty())
        {
            query.push(("filter.genre", genre.to_lowercase()));
        }
        if let Some(duration) = self.duration {
            query.push(("filter.duration", duration.api_value().to_owned()));
        }
        if let Some(created) = self.created {
            query.push(("filter.created_at", created.api_value().to_owned()));
        }
        if let Some(license) = self.license {
            query.push(("filter.license", license.api_value().to_owned()));
        }
        if self.go_plus_only {
            query.push(("filter.content_tier", "SUB_HIGH_TIER".to_owned()));
        }
        query
    }
}

impl Client {
    /// Everything at once — tracks, people, playlists — interleaved.
    pub async fn search(&self, query: &str, page: OffsetRequest) -> Result<SearchPage<Resource>> {
        self.search_page("/search", query, &[], page, |value: serde_json::Value| {
            let kind = value["kind"].as_str()?.to_owned();
            match kind.as_str() {
                "track" => serde_json::from_value(value)
                    .ok()
                    .map(|raw| Resource::Track(Track::from_raw(raw))),
                "user" => serde_json::from_value(value)
                    .ok()
                    .map(|raw| Resource::User(User::from_raw(raw))),
                "playlist" => serde_json::from_value(value)
                    .ok()
                    .map(|raw| Resource::Playlist(Playlist::from_raw(raw))),
                _ => None,
            }
        })
        .await
    }

    pub async fn search_tracks(
        &self,
        query: &str,
        filters: &TrackFilters,
        page: OffsetRequest,
    ) -> Result<SearchPage<Track>> {
        let extra = filters.query();
        self.search_page("/search/tracks", query, &extra, page, |raw| {
            Some(Track::from_raw(raw))
        })
        .await
    }

    pub async fn search_users(&self, query: &str, page: OffsetRequest) -> Result<SearchPage<User>> {
        self.search_page("/search/users", query, &[], page, |raw| {
            Some(User::from_raw(raw))
        })
        .await
    }

    /// Playlists, albums included.
    pub async fn search_playlists(
        &self,
        query: &str,
        page: OffsetRequest,
    ) -> Result<SearchPage<Playlist>> {
        self.search_page("/search/playlists", query, &[], page, |raw| {
            Some(Playlist::from_raw(raw))
        })
        .await
    }

    pub async fn search_albums(
        &self,
        query: &str,
        page: OffsetRequest,
    ) -> Result<SearchPage<Playlist>> {
        self.search_page("/search/albums", query, &[], page, |raw| {
            Some(Playlist::from_raw(raw))
        })
        .await
    }

    /// Suggestions while typing. A blank query has none and is not sent.
    pub async fn autocomplete(&self, query: &str, limit: u32) -> Result<Vec<Suggestion>> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(Vec::new());
        }
        let limit = clamp_limit(Some(limit));
        let url = self.api_url(
            "/search/queries",
            &[("q", query), ("limit", &limit.to_string())],
        );
        let raw: raw::Collection<raw::Suggestion> = self.get_json(url, Kind::Read).await?;
        // SoundCloud ignores `limit` here (nine back for five asked).
        Ok(raw
            .collection
            .0
            .into_iter()
            .filter_map(Suggestion::from_raw)
            .take(limit as usize)
            .collect())
    }

    async fn search_page<R, T>(
        &self,
        path: &str,
        query: &str,
        extra: &[(&str, String)],
        page: OffsetRequest,
        convert: impl FnMut(R) -> Option<T>,
    ) -> Result<SearchPage<T>>
    where
        R: DeserializeOwned,
    {
        let query = query.trim();
        if query.is_empty() {
            return Err(Error::invalid("the search is empty"));
        }
        let limit = clamp_limit(page.limit);
        let (limit_text, offset_text) = (limit.to_string(), page.offset.to_string());
        let mut params = vec![
            ("q", query),
            ("limit", limit_text.as_str()),
            ("offset", offset_text.as_str()),
        ];
        params.extend(extra.iter().map(|(name, value)| (*name, value.as_str())));
        let url = self.api_url(path, &params);

        let raw: raw::Collection<R> = self.get_json(url, Kind::Read).await?;
        let items = raw.collection.0;
        // An empty page ends the results, so the UI can never page forever.
        let next_offset = if items.is_empty() {
            None
        } else {
            next_offset(raw.next_href.as_deref(), page.offset, limit)
        };
        Ok(SearchPage {
            items: items.into_iter().filter_map(convert).collect(),
            total: raw.total_results,
            next_offset,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_become_query_parameters() {
        let filters = TrackFilters {
            genre: Some("  Deep House ".into()),
            duration: Some(DurationFilter::Epic),
            created: Some(CreatedWithin::LastWeek),
            license: Some(LicenseFilter::ToModifyCommercially),
            go_plus_only: true,
        };
        let query = filters.query();
        let pairs: Vec<(&str, &str)> = query.iter().map(|(k, v)| (*k, v.as_str())).collect();
        assert_eq!(
            pairs,
            [
                ("filter.genre", "deep house"),
                ("filter.duration", "epic"),
                ("filter.created_at", "last_week"),
                ("filter.license", "to_modify_commercially"),
                ("filter.content_tier", "SUB_HIGH_TIER"),
            ]
        );
    }

    #[test]
    fn no_filters_no_parameters() {
        assert!(TrackFilters::default().query().is_empty());
        let blank_genre = TrackFilters {
            genre: Some("   ".into()),
            ..TrackFilters::default()
        };
        assert!(blank_genre.query().is_empty());
    }

    #[test]
    fn known_values_parse_in_either_spelling() {
        assert_eq!(
            "last_week".parse::<CreatedWithin>().unwrap(),
            CreatedWithin::LastWeek
        );
        assert_eq!(
            "Last-Week".parse::<CreatedWithin>().unwrap(),
            CreatedWithin::LastWeek
        );
        assert_eq!(
            "epic".parse::<DurationFilter>().unwrap(),
            DurationFilter::Epic
        );
        assert_eq!(
            "to_share".parse::<LicenseFilter>().unwrap(),
            LicenseFilter::ToShare
        );
    }

    #[test]
    fn unknown_values_are_rejected() {
        for bad in ["yesterday", "", "last week"] {
            let err = bad.parse::<CreatedWithin>().unwrap_err();
            assert_eq!(err.kind(), crate::ErrorKind::InvalidInput, "{bad:?}");
        }
        assert!("bogus".parse::<DurationFilter>().is_err());
        assert!("cc-by".parse::<LicenseFilter>().is_err());
        assert!(serde_json::from_str::<TrackFilters>(r#"{"duration":"bogus"}"#).is_err());
    }

    #[test]
    fn filters_deserialize_from_the_frontend() {
        let filters: TrackFilters =
            serde_json::from_str(r#"{"genre":"House","created":"last-month","goPlusOnly":true}"#)
                .unwrap();
        assert_eq!(filters.created, Some(CreatedWithin::LastMonth));
        assert!(filters.go_plus_only);
        assert_eq!(filters.duration, None);
    }
}
