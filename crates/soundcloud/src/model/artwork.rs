//! Artwork and avatar URLs.
//!
//! SoundCloud's image URLs end in a size token (`…-large.jpg` is 100×100);
//! the same image at another size is the same URL with another token.

use serde::{Deserialize, Serialize};

/// Sizes the image CDN serves.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArtworkSize {
    /// `-large`, what the API hands out.
    Px100,
    /// `-t300x300`.
    Px300,
    /// `-t500x500`.
    Px500,
    /// `-original`, whatever was uploaded (can be several megabytes).
    Original,
}

impl ArtworkSize {
    fn token(self) -> &'static str {
        match self {
            Self::Px100 => "large",
            Self::Px300 => "t300x300",
            Self::Px500 => "t500x500",
            Self::Original => "original",
        }
    }
}

/// The same artwork or avatar at another size.
///
/// URLs without a recognisable size token (SoundCloud's default avatar, or
/// anything unexpected) come back unchanged rather than broken.
pub fn artwork_url(url: &str, size: ArtworkSize) -> String {
    let split = url.find(['?', '#']).unwrap_or(url.len());
    let (path, suffix) = url.split_at(split);
    let file_start = path.rfind('/').map_or(0, |slash| slash + 1);
    let (dir, file) = path.split_at(file_start);
    let Some(dot) = file.rfind('.') else {
        return url.to_owned();
    };
    let (stem, extension) = file.split_at(dot);
    let Some((name, token)) = stem.rsplit_once('-') else {
        return url.to_owned();
    };
    if !is_size_token(token) {
        return url.to_owned();
    }
    format!("{dir}{name}-{}{extension}{suffix}", size.token())
}

fn is_size_token(token: &str) -> bool {
    matches!(
        token,
        "large" | "original" | "crop" | "small" | "tiny" | "mini" | "badge"
    ) || token
        .strip_prefix('t')
        .and_then(|dims| dims.split_once('x'))
        .is_some_and(|(w, h)| is_number(w) && is_number(h))
}

fn is_number(text: &str) -> bool {
    !text.is_empty() && text.bytes().all(|b| b.is_ascii_digit())
}

/// SoundCloud's grey placeholder, which the UI is better off drawing itself.
pub(crate) fn is_default_avatar(url: &str) -> bool {
    url.contains("/images/default_avatar")
}

/// A track without art shows its uploader's avatar, as on soundcloud.com.
pub(crate) fn track_artwork(own: Option<String>, uploader_avatar: Option<&str>) -> Option<String> {
    own.or_else(|| uploader_avatar.map(str::to_owned))
}

/// A playlist without art shows its first track's art, then its owner's avatar.
pub(crate) fn playlist_artwork(
    own: Option<String>,
    first_track_art: Option<&str>,
    owner_avatar: Option<&str>,
) -> Option<String> {
    own.or_else(|| first_track_art.map(str::to_owned))
        .or_else(|| owner_avatar.map(str::to_owned))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swaps_the_size_token() {
        let art = "https://i1.sndcdn.com/artworks-000067273316-smsiqx-large.jpg";
        assert_eq!(
            artwork_url(art, ArtworkSize::Px500),
            "https://i1.sndcdn.com/artworks-000067273316-smsiqx-t500x500.jpg"
        );
        assert_eq!(
            artwork_url(art, ArtworkSize::Original),
            "https://i1.sndcdn.com/artworks-000067273316-smsiqx-original.jpg"
        );
        let big = "https://i1.sndcdn.com/avatars-000012778523-59quu3-t500x500.png?x=1";
        assert_eq!(
            artwork_url(big, ArtworkSize::Px100),
            "https://i1.sndcdn.com/avatars-000012778523-59quu3-large.png?x=1"
        );
        assert_eq!(
            artwork_url(
                "https://i1.sndcdn.com/artworks-EgnfQrHOrnqE-0-t300x300.jpg",
                ArtworkSize::Px300
            ),
            "https://i1.sndcdn.com/artworks-EgnfQrHOrnqE-0-t300x300.jpg"
        );
    }

    #[test]
    fn leaves_unknown_shapes_alone() {
        for url in [
            "https://a1.sndcdn.com/images/default_avatar_large.png",
            "https://i1.sndcdn.com/artworks-000067273316-smsiqx.jpg",
            "https://i1.sndcdn.com/artworks-no-extension-large",
            "https://example.com/t500x500/cover-large-ish.jpg",
            "",
        ] {
            assert_eq!(artwork_url(url, ArtworkSize::Px500), url);
        }
    }

    #[test]
    fn recognises_the_default_avatar() {
        assert!(is_default_avatar(
            "https://a1.sndcdn.com/images/default_avatar_large.png"
        ));
        assert!(!is_default_avatar(
            "https://i1.sndcdn.com/avatars-000012778523-59quu3-large.jpg"
        ));
    }

    #[test]
    fn fallbacks_follow_the_website() {
        let own = Some("own".to_owned());
        assert_eq!(
            track_artwork(own.clone(), Some("avatar")).as_deref(),
            Some("own")
        );
        assert_eq!(
            track_artwork(None, Some("avatar")).as_deref(),
            Some("avatar")
        );
        assert_eq!(track_artwork(None, None), None);

        assert_eq!(
            playlist_artwork(own, Some("first"), Some("owner")).as_deref(),
            Some("own")
        );
        assert_eq!(
            playlist_artwork(None, Some("first"), Some("owner")).as_deref(),
            Some("first")
        );
        assert_eq!(
            playlist_artwork(None, None, Some("owner")).as_deref(),
            Some("owner")
        );
        assert_eq!(playlist_artwork(None, None, None), None);
    }
}
