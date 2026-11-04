//! Against the real SoundCloud, signed out, public data only. Ignored by
//! default; run with `cargo test -p soundcloud -- --ignored --nocapture`.
//!
//! Each test pins down a fact the crate relies on. When one fails, SoundCloud
//! changed something: fix the crate and `docs/soundcloud-api.md` together.

use std::future::Future;
use std::sync::LazyLock;

use soundcloud::{Client, ErrorKind, OffsetRequest, PageRequest, Resource, TrackFilters};
use tokio::runtime::Runtime;
use url::Url;

/// "Flickermood" by Forss (SoundCloud's co-founder), online since 2007.
const KNOWN_TRACK_URL: &str = "https://soundcloud.com/forss/flickermood";
const KNOWN_TRACK_ID: u64 = 293;
const KNOWN_USER_ID: u64 = 183;

/// One runtime and one client for the whole run, so the `client_id` is
/// looked up once rather than once per test.
static RUNTIME: LazyLock<Runtime> = LazyLock::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("a tokio runtime")
});
static CLIENT: LazyLock<Client> = LazyLock::new(|| Client::new().expect("a client"));

fn live<F: Future>(test: F) -> F::Output {
    RUNTIME.block_on(test)
}

fn first(limit: u32) -> OffsetRequest {
    OffsetRequest {
        offset: 0,
        limit: Some(limit),
    }
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn discovers_a_working_client_id() {
    live(async {
        // A client of its own, so this lookup is not one another test already did.
        let client = Client::new().unwrap();
        client.warm_up().await.expect("client_id discovery");
        let track = client
            .track(KNOWN_TRACK_ID)
            .await
            .expect("a public read with that key");
        assert_eq!(track.id, KNOWN_TRACK_ID);
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn searches_tracks() {
    live(async {
        let page = CLIENT
            .search_tracks("flickermood", &TrackFilters::default(), first(10))
            .await
            .unwrap();
        println!(
            "search: {} items, total {:?}, next offset {:?}",
            page.items.len(),
            page.total,
            page.next_offset
        );
        assert!(!page.items.is_empty());
        assert!(page.total.unwrap_or(0) > 0);
        assert!(page.items.iter().all(|track| !track.title.is_empty()));
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn searches_everything_and_suggests() {
    live(async {
        let page = CLIENT.search("forss", first(10)).await.unwrap();
        assert!(
            page.items
                .iter()
                .any(|item| matches!(item, Resource::User(_)))
        );
        let suggestions = CLIENT.autocomplete("daft", 5).await.unwrap();
        println!(
            "autocomplete: {:?}",
            suggestions.iter().map(|s| &s.query).collect::<Vec<_>>()
        );
        assert!(!suggestions.is_empty() && suggestions.len() <= 5);
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn counts_the_genres_of_a_search() {
    live(async {
        let genres = CLIENT
            .search_track_genres("deep house", &TrackFilters::default())
            .await
            .unwrap();
        println!(
            "genres: {:?}",
            genres
                .iter()
                .map(|g| (&g.genre, g.count))
                .collect::<Vec<_>>()
        );
        assert!(!genres.is_empty());
        assert!(genres.windows(2).all(|pair| pair[0].count >= pair[1].count));
        assert!(
            genres
                .iter()
                .all(|g| g.genre == g.genre.to_lowercase() && g.count > 0)
        );
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn genre_filter_is_matched_in_lowercase() {
    live(async {
        let filters = TrackFilters {
            genre: Some("Deep House".into()),
            ..TrackFilters::default()
        };
        let page = CLIENT
            .search_tracks("music", &filters, first(10))
            .await
            .unwrap();
        assert!(!page.items.is_empty(), "a capitalised genre found nothing");
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn resolves_a_known_public_track() {
    live(async {
        for link in [
            KNOWN_TRACK_URL,
            "soundcloud.com/forss/flickermood/",
            "https://m.soundcloud.com/forss/flickermood",
            "https://www.soundcloud.com/forss/flickermood?si=0123456789abcdef&utm_source=clipboard",
        ] {
            match CLIENT.resolve(link).await.unwrap() {
                Resource::Track(track) => {
                    assert_eq!(track.id, KNOWN_TRACK_ID, "{link}");
                    assert_eq!(track.title, "Flickermood");
                    assert_eq!(track.user.unwrap().username, "Forss");
                    assert!(track.artwork_url.is_some());
                }
                other => panic!("{link} resolved to {other:?}"),
            }
        }
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn resolves_short_links() {
    live(async {
        // Share links from the app turn up in plenty of descriptions.
        let page = CLIENT
            .search_tracks("on.soundcloud.com", &TrackFilters::default(), first(100))
            .await
            .unwrap();
        let links: Vec<String> = page
            .items
            .iter()
            .filter_map(|track| track.description.as_deref())
            .flat_map(|text| text.split_whitespace())
            .filter(|word| word.starts_with("https://on.soundcloud.com/"))
            .map(|word| {
                word.trim_end_matches(|c: char| !c.is_ascii_alphanumeric())
                    .to_owned()
            })
            .take(5)
            .collect();
        assert!(!links.is_empty(), "no short link found to try");
        let mut resolved = 0;
        for link in &links {
            match CLIENT.resolve(link).await {
                Ok(_) => resolved += 1,
                // A short link can outlive what it pointed at.
                Err(error) if error.kind() == ErrorKind::NotFound => {}
                Err(error) => panic!("{link}: {error}"),
            }
        }
        println!("short links: {resolved} of {} resolved", links.len());
        assert!(resolved > 0);
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn resolves_a_stream_url() {
    live(async {
        let stream = CLIENT.stream(KNOWN_TRACK_ID).await.unwrap();
        let url = Url::parse(&stream.url).unwrap();
        println!(
            "stream: {:?} {} from {}",
            stream.protocol,
            stream.mime_type,
            url.host_str().unwrap_or_default()
        );
        assert!(matches!(url.scheme(), "http" | "https"));
        assert!(!stream.preview);
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn go_plus_tracks_play_as_previews() {
    live(async {
        let filters = TrackFilters {
            go_plus_only: true,
            ..TrackFilters::default()
        };
        let page = CLIENT
            .search_tracks("daft punk", &filters, first(5))
            .await
            .unwrap();
        let track = page.items.first().expect("a Go+ track");
        assert!(track.access.go_plus && track.access.preview);
        let stream = CLIENT.stream(track.id).await.unwrap();
        println!("preview: {:?} {}", stream.protocol, stream.mime_type);
        assert!(stream.preview);
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn reads_a_waveform() {
    live(async {
        let track = CLIENT.track(KNOWN_TRACK_ID).await.unwrap();
        let waveform = CLIENT
            .waveform(track.waveform_url.as_deref().expect("a waveform URL"))
            .await
            .unwrap();
        assert!(waveform.width > 0 && waveform.height > 0);
        assert_eq!(waveform.samples.len(), waveform.width as usize);
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn hydrates_a_big_public_playlist() {
    live(async {
        // Found by search, so the test does not hang on one playlist surviving.
        let found = CLIENT
            .search_playlists("house music", first(50))
            .await
            .unwrap();
        let big = found
            .items
            .iter()
            .filter(|playlist| playlist.track_count >= 200)
            .max_by_key(|playlist| playlist.track_count)
            .expect("a public playlist with 200+ tracks");
        let playlist = CLIENT.playlist(big.id).await.unwrap();
        let tracks = playlist.tracks.expect("all tracks");
        println!(
            "playlist {}: {} of {} tracks hydrated",
            playlist.id,
            tracks.len(),
            playlist.track_count
        );
        assert!(tracks.len() > 5, "only the complete ones came back");
        // Some tracks may be gone or private since they were added.
        assert!(tracks.len() * 10 >= playlist.track_count as usize * 9);
        assert!(tracks.iter().all(|track| !track.title.is_empty()));
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn pages_a_list_with_cursors() {
    live(async {
        let first = CLIENT
            .user_followers(KNOWN_USER_ID, PageRequest::first(5))
            .await
            .unwrap();
        let cursor = first.next.clone().expect("more followers");
        assert!(!cursor.as_str().contains("client_id"));
        let second = CLIENT
            .user_followers(KNOWN_USER_ID, PageRequest::after(cursor))
            .await
            .unwrap();
        assert!(!second.items.is_empty());
        let overlap = second
            .items
            .iter()
            .filter(|user| first.items.iter().any(|seen| seen.id == user.id))
            .count();
        assert_eq!(overlap, 0, "pages overlap");

        // `next_href` of comments carries a client_id of its own; it must not leak.
        let comments = CLIENT
            .track_comments(KNOWN_TRACK_ID, PageRequest::first(3))
            .await
            .unwrap();
        assert!(!comments.items.is_empty());
        assert!(
            comments
                .next
                .is_some_and(|next| !next.as_str().contains("client_id"))
        );
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn profile_lists_answer() {
    live(async {
        let id = KNOWN_USER_ID;
        let page = || PageRequest::first(5);
        let user = CLIENT.user(id).await.unwrap();
        assert_eq!(user.username, "Forss");
        assert!(
            !CLIENT
                .user_tracks(id, page())
                .await
                .unwrap()
                .items
                .is_empty()
        );
        assert!(
            !CLIENT
                .user_top_tracks(id, page())
                .await
                .unwrap()
                .items
                .is_empty()
        );
        assert!(
            CLIENT
                .user_albums(id, page())
                .await
                .unwrap()
                .items
                .iter()
                .all(|p| p.is_album)
        );
        CLIENT.user_playlists(id, page()).await.unwrap();
        assert!(
            !CLIENT
                .user_liked_tracks(id, page())
                .await
                .unwrap()
                .items
                .is_empty()
        );
        CLIENT.user_liked_playlists(id, page()).await.unwrap();
        assert!(
            !CLIENT
                .user_followings(id, page())
                .await
                .unwrap()
                .items
                .is_empty()
        );
        CLIENT.user_reposts(id, page()).await.unwrap();
        assert!(
            !CLIENT
                .related_artists(id, page())
                .await
                .unwrap()
                .items
                .is_empty()
        );
        assert!(
            !CLIENT
                .related_tracks(KNOWN_TRACK_ID, page())
                .await
                .unwrap()
                .items
                .is_empty()
        );
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn discovery_answers() {
    live(async {
        let station = CLIENT.track_station(KNOWN_TRACK_ID, 10).await.unwrap();
        assert!(!station.is_empty() && station.len() <= 10);
        let artist = CLIENT.artist_station(KNOWN_USER_ID, 10).await.unwrap();
        assert!(!artist.is_empty());
        let rows = CLIENT.mixed_selections(10).await.unwrap();
        println!(
            "home rows: {:?}",
            rows.iter().map(|row| &row.title).collect::<Vec<_>>()
        );
        assert!(rows.iter().all(|row| !row.playlists.is_empty()));
    });
}

#[test]
#[ignore = "talks to the real SoundCloud"]
fn refusals_are_classified() {
    live(async {
        // A missing track is a plain 404, not a key problem.
        let error = CLIENT.track(1).await.unwrap_err();
        assert_eq!(error.kind(), ErrorKind::NotFound);
        // A link to SoundCloud that opens nothing.
        let error = CLIENT
            .resolve("https://soundcloud.com/forss/no-such-track-here")
            .await
            .unwrap_err();
        assert_eq!(error.kind(), ErrorKind::NotFound);
    });
}
