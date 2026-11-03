//! The client against local mock servers: where keys and tokens go, how
//! refusals are read, and how lists are paged. One mock server stands in for
//! soundcloud.com (the `client_id` lookup), another for api-v2.

use std::time::Duration;

use futures_util::future::join_all;
use serde_json::{Value, json};
use soundcloud::{
    Client, Cursor, ErrorKind, OffsetRequest, PageRequest, Resource, StreamProtocol, Token,
    TrackFilters,
};
use url::Url;
use wiremock::matchers::{body_json, header, method, path, query_param, query_param_is_missing};
use wiremock::{Mock, MockServer, Request, ResponseTemplate};

const KEY_A: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const KEY_B: &str = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const TOKEN: &str = "2-123456-42-AbCdEfGhIjKl";

/// soundcloud.com and api-v2, both local.
struct World {
    web: MockServer,
    api: MockServer,
}

impl World {
    async fn new() -> Self {
        Self {
            web: MockServer::start().await,
            api: MockServer::start().await,
        }
    }

    fn client(&self) -> Client {
        Client::builder()
            .web_base(Url::parse(&self.web.uri()).unwrap())
            .api_base(Url::parse(&self.api.uri()).unwrap())
            .build()
            .unwrap()
    }

    fn signed_in_client(&self) -> Client {
        let client = self.client();
        client.set_token(Token::new(TOKEN).unwrap());
        client
    }

    /// The home page, listing two bundles.
    async fn serve_page(&self, times: u64) {
        let html = r#"<!DOCTYPE html><html><head>
            <script crossorigin src="/assets/vendor.js"></script>
            <script crossorigin src="/assets/app.js"></script>
        </head></html>"#;
        Mock::given(method("GET"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_string(html))
            .expect(times)
            .mount(&self.web)
            .await;
    }

    /// The page plus a last bundle holding `key`, for as long as the test runs.
    async fn serve_key(&self, key: &str) {
        self.serve_page(1).await;
        Mock::given(method("GET"))
            .and(path("/assets/app.js"))
            .respond_with(ResponseTemplate::new(200).set_body_string(bundle(key)))
            .mount(&self.web)
            .await;
    }

    /// A first lookup that finds `first`, then every later one `second`.
    async fn serve_rotating_key(&self, first: &str, second: &str) {
        self.serve_page(2).await;
        Mock::given(method("GET"))
            .and(path("/assets/app.js"))
            .respond_with(ResponseTemplate::new(200).set_body_string(bundle(first)))
            .up_to_n_times(1)
            .with_priority(1)
            .mount(&self.web)
            .await;
        Mock::given(method("GET"))
            .and(path("/assets/app.js"))
            .respond_with(ResponseTemplate::new(200).set_body_string(bundle(second)))
            .with_priority(2)
            .mount(&self.web)
            .await;
    }

    async fn api_requests(&self) -> Vec<Request> {
        self.api.received_requests().await.unwrap_or_default()
    }

    async fn web_requests(&self) -> Vec<Request> {
        self.web.received_requests().await.unwrap_or_default()
    }
}

fn bundle(key: &str) -> String {
    format!(r#"(()=>{{var e={{env:"production",client_id:"{key}",api:"x"}};}})();"#)
}

fn track(id: u64) -> Value {
    json!({
        "id": id,
        "kind": "track",
        "title": format!("Track {id}"),
        "duration": 1000,
        "user": { "id": 100, "username": "artist" },
    })
}

fn user(id: u64) -> Value {
    json!({ "id": id, "kind": "user", "username": format!("user {id}") })
}

fn ok_json(body: Value) -> ResponseTemplate {
    ResponseTemplate::new(200).set_body_json(body)
}

#[tokio::test]
async fn the_key_is_read_from_the_last_bundle_first() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    Mock::given(path("/assets/vendor.js"))
        .respond_with(ResponseTemplate::new(200).set_body_string("no key here"))
        .expect(0)
        .mount(&world.web)
        .await;
    Mock::given(method("GET"))
        .and(path("/tracks/1"))
        .and(query_param("client_id", KEY_A))
        .respond_with(ok_json(track(1)))
        .expect(1)
        .mount(&world.api)
        .await;

    let track = world.client().track(1).await.unwrap();
    assert_eq!(track.title, "Track 1");
}

#[tokio::test]
async fn concurrent_callers_share_one_lookup() {
    let world = World::new().await;
    let html = r#"<script src="/assets/app.js"></script>"#;
    Mock::given(path("/"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_string(html)
                .set_delay(Duration::from_millis(200)),
        )
        .expect(1)
        .mount(&world.web)
        .await;
    Mock::given(path("/assets/app.js"))
        .respond_with(ResponseTemplate::new(200).set_body_string(bundle(KEY_A)))
        .expect(1)
        .mount(&world.web)
        .await;
    Mock::given(path("/tracks/1"))
        .respond_with(ok_json(track(1)))
        .expect(8)
        .mount(&world.api)
        .await;

    let client = world.client();
    let results = join_all((0..8).map(|_| client.track(1))).await;
    assert!(results.iter().all(Result::is_ok));
}

#[tokio::test]
async fn a_refused_key_is_replaced_and_the_request_retried_once() {
    let world = World::new().await;
    world.serve_rotating_key(KEY_A, KEY_B).await;
    Mock::given(path("/tracks/1"))
        .and(query_param("client_id", KEY_A))
        .respond_with(ResponseTemplate::new(401))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(path("/tracks/1"))
        .and(query_param("client_id", KEY_B))
        .respond_with(ok_json(track(1)))
        .expect(1)
        .mount(&world.api)
        .await;

    let client = world.client();
    assert_eq!(client.track(1).await.unwrap().id, 1);
}

#[tokio::test]
async fn a_second_401_with_a_session_means_the_session_is_over() {
    let world = World::new().await;
    world.serve_rotating_key(KEY_A, KEY_B).await;
    Mock::given(path("/me"))
        .respond_with(ResponseTemplate::new(401))
        .expect(2)
        .mount(&world.api)
        .await;

    let error = world.signed_in_client().me().await.unwrap_err();
    assert_eq!(error.kind(), ErrorKind::Unauthorized);
}

#[tokio::test]
async fn a_second_401_without_a_session_blames_the_key() {
    let world = World::new().await;
    world.serve_rotating_key(KEY_A, KEY_B).await;
    Mock::given(path("/tracks/1"))
        .respond_with(ResponseTemplate::new(401))
        .expect(2)
        .mount(&world.api)
        .await;

    let error = world.client().track(1).await.unwrap_err();
    assert_eq!(error.kind(), ErrorKind::ClientId);
}

#[tokio::test]
async fn finding_the_same_key_again_stops_the_lookups() {
    let world = World::new().await;
    // Two lookups in all: the first, and one re-check after the first refusal.
    world.serve_page(2).await;
    Mock::given(path("/assets/app.js"))
        .respond_with(ResponseTemplate::new(200).set_body_string(bundle(KEY_A)))
        .expect(2)
        .mount(&world.web)
        .await;
    // A dead session: no retry with an unchanged key, and no lookup storm.
    Mock::given(path("/me"))
        .respond_with(ResponseTemplate::new(401))
        .expect(3)
        .mount(&world.api)
        .await;

    let client = world.signed_in_client();
    for _ in 0..3 {
        assert_eq!(
            client.me().await.unwrap_err().kind(),
            ErrorKind::Unauthorized
        );
    }
}

#[tokio::test]
async fn datadome_refusing_a_write_is_reported_as_bot_protection() {
    let world = World::new().await;
    // One lookup only: DataDome says nothing about the key.
    world.serve_key(KEY_A).await;
    let origin = world.web.uri();
    Mock::given(method("GET"))
        .and(path("/me"))
        .respond_with(ok_json(json!({ "id": 42, "username": "me" })))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(method("PUT"))
        .and(path("/users/42/track_likes/7"))
        .and(query_param("client_id", KEY_A))
        .and(header("authorization", format!("OAuth {TOKEN}").as_str()))
        .and(header("origin", origin.as_str()))
        .and(header("referer", format!("{origin}/").as_str()))
        .and(header("content-type", "application/json"))
        .and(body_json(json!({})))
        .respond_with(
            ResponseTemplate::new(403)
                .insert_header("x-datadome", "protected")
                .set_body_json(json!({ "url": "https://geo.captcha-delivery.com/captcha/" })),
        )
        .expect(1)
        .mount(&world.api)
        .await;

    let error = world.signed_in_client().like_track(7).await.unwrap_err();
    assert_eq!(error.kind(), ErrorKind::BotFiltered);
}

#[tokio::test]
async fn writes_succeed_with_the_users_id_cached() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    Mock::given(path("/me"))
        .respond_with(ok_json(json!({ "id": 42, "username": "me" })))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(method("PUT"))
        .and(path("/users/42/playlist_likes/5"))
        .respond_with(ResponseTemplate::new(200).set_body_string("{}"))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(method("POST"))
        .and(path("/me/followings/9"))
        .respond_with(ResponseTemplate::new(201))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(method("DELETE"))
        .and(path("/users/42/track_likes/7"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&world.api)
        .await;

    let client = world.signed_in_client();
    client.like_playlist(5).await.unwrap();
    client.follow(9).await.unwrap();
    client.unlike_track(7).await.unwrap();
}

#[tokio::test]
async fn the_token_goes_to_the_api_and_nowhere_else() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    Mock::given(path("/tracks/1"))
        .and(header("authorization", format!("OAuth {TOKEN}").as_str()))
        .respond_with(ok_json(track(1)))
        .expect(1)
        .mount(&world.api)
        .await;

    let client = world.signed_in_client();
    client.track(1).await.unwrap();

    let web = world.web_requests().await;
    assert_eq!(web.len(), 2, "the page and one bundle");
    for request in &web {
        assert!(
            !request.headers.contains_key("authorization"),
            "{}",
            request.url
        );
        assert!(
            !request.url.as_str().contains("client_id"),
            "{}",
            request.url
        );
    }

    // A cursor or a waveform URL naming another host is refused before sending.
    let foreign: Cursor =
        serde_json::from_value(json!(format!("{}/users/1/followers", world.web.uri()))).unwrap();
    let error = client
        .user_followers(1, PageRequest::after(foreign))
        .await
        .unwrap_err();
    assert_eq!(error.kind(), ErrorKind::InvalidInput);
    let error = client
        .waveform(&format!("{}/w.json", world.web.uri()))
        .await
        .unwrap_err();
    assert_eq!(error.kind(), ErrorKind::InvalidInput);
    assert_eq!(world.web_requests().await.len(), 2);
}

#[tokio::test]
async fn signed_out_private_calls_send_nothing() {
    let world = World::new().await;
    let client = world.client();
    for error in [
        client.me().await.unwrap_err(),
        client.feed(PageRequest::default()).await.unwrap_err(),
        client
            .play_history(PageRequest::default())
            .await
            .unwrap_err(),
        client.like_track(1).await.unwrap_err(),
        client.follow(1).await.unwrap_err(),
    ] {
        assert_eq!(error.kind(), ErrorKind::SignInRequired);
    }
    assert!(world.web_requests().await.is_empty());
    assert!(world.api_requests().await.is_empty());
}

#[tokio::test]
async fn cursor_pages_follow_next_href_with_a_fresh_key() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    let next_href = format!(
        "{}/users/5/followers?offset=1700000000000&limit=2&client_id=STALEKEY",
        world.api.uri()
    );
    Mock::given(path("/users/5/followers"))
        .and(query_param_is_missing("offset"))
        .and(query_param("linked_partitioning", "1"))
        .and(query_param("limit", "2"))
        .respond_with(ok_json(json!({
            "collection": [user(1), user(2)],
            "next_href": next_href,
        })))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(path("/users/5/followers"))
        .and(query_param("offset", "1700000000000"))
        .and(query_param("client_id", KEY_A))
        .respond_with(ok_json(
            json!({ "collection": [user(3)], "next_href": null }),
        ))
        .expect(1)
        .mount(&world.api)
        .await;

    let client = world.client();
    let first = client
        .user_followers(5, PageRequest::first(2))
        .await
        .unwrap();
    assert_eq!(first.items.len(), 2);
    let cursor = first.next.expect("a second page");
    assert!(!cursor.as_str().contains("client_id"));

    // The cursor travels through the frontend as a plain string.
    let cursor: Cursor = serde_json::from_value(serde_json::to_value(&cursor).unwrap()).unwrap();
    let second = client
        .user_followers(5, PageRequest::after(cursor))
        .await
        .unwrap();
    assert_eq!(second.items[0].username, "user 3");
    assert!(second.next.is_none());

    for request in world.api_requests().await {
        assert!(!request.url.as_str().contains("STALEKEY"));
    }
}

#[tokio::test]
async fn search_pages_by_offset_with_filters() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    Mock::given(path("/search/tracks"))
        .and(query_param("q", "deep cuts"))
        .and(query_param("offset", "0"))
        .and(query_param("limit", "2"))
        .and(query_param("filter.genre", "deep house"))
        .and(query_param("filter.duration", "long"))
        .respond_with(ok_json(json!({
            "collection": [track(1), track(2)],
            "total_results": 9,
            "next_href": format!("{}/search/tracks?query_urn=x&offset=2&limit=2&q=deep%20cuts", world.api.uri()),
        })))
        .expect(1)
        .mount(&world.api)
        .await;

    let filters: TrackFilters =
        serde_json::from_value(json!({ "genre": "Deep House", "duration": "long" })).unwrap();
    let page = world
        .client()
        .search_tracks(
            "  deep cuts ",
            &filters,
            OffsetRequest {
                offset: 0,
                limit: Some(2),
            },
        )
        .await
        .unwrap();
    assert_eq!(page.items.len(), 2);
    assert_eq!(page.total, Some(9));
    assert_eq!(page.next_offset, Some(2));

    let error = world
        .client()
        .search("   ", OffsetRequest::default())
        .await
        .unwrap_err();
    assert_eq!(error.kind(), ErrorKind::InvalidInput);
}

#[tokio::test]
async fn genre_counts_leave_the_genre_out_and_keep_the_other_filters() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    Mock::given(path("/search/tracks"))
        .and(query_param("q", "pyrokinesis"))
        .and(query_param("facet", "genre"))
        .and(query_param("limit", "1"))
        .and(query_param("filter.duration", "long"))
        .and(query_param_is_missing("filter.genre"))
        .respond_with(ok_json(json!({
            "collection": [track(1)],
            "total_results": 13,
            "facets": [{ "name": "genre", "facets": [
                { "value": "rock", "count": 1, "filter": "filter.genre=rock" },
                { "value": "ambient", "count": 2, "filter": "filter.genre=ambient" },
            ]}],
        })))
        .expect(1)
        .mount(&world.api)
        .await;

    let filters: TrackFilters =
        serde_json::from_value(json!({ "genre": "Rock", "duration": "long" })).unwrap();
    let genres = world
        .client()
        .search_track_genres("pyrokinesis", &filters)
        .await
        .unwrap();
    let counts: Vec<(&str, u64)> = genres
        .iter()
        .map(|genre| (genre.genre.as_str(), genre.count))
        .collect();
    assert_eq!(counts, [("ambient", 2), ("rock", 1)]);
}

#[tokio::test]
async fn stream_prefers_progressive_mp3_and_sends_the_session_on_both_hops() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    let api = world.api.uri();
    let auth = format!("OAuth {TOKEN}");
    let transcoding = |name: &str, protocol: &str, mime: &str, preset: &str| {
        json!({
            "url": format!("{api}/media/soundcloud:tracks:9/{name}/stream/{protocol}"),
            "preset": preset, "snipped": false, "quality": "sq",
            "format": { "protocol": protocol, "mime_type": mime },
        })
    };
    let mut body = track(9);
    body["track_authorization"] = json!("TRACK-AUTH");
    body["media"] = json!({ "transcodings": [
        transcoding("enc", "cbc-encrypted-hls", "audio/mp4; codecs=\"mp4a.40.2\"", "aac_160k"),
        transcoding("abr", "hls", "audio/mpegurl", "abr_sq"),
        transcoding("aac", "hls", "audio/mp4; codecs=\"mp4a.40.2\"", "aac_160k"),
        transcoding("mp3", "progressive", "audio/mpeg", "mp3_1_0"),
    ]});
    Mock::given(path("/tracks/9"))
        .and(header("authorization", auth.as_str()))
        .respond_with(ok_json(body))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(path("/media/soundcloud:tracks:9/mp3/stream/progressive"))
        .and(query_param("track_authorization", "TRACK-AUTH"))
        .and(query_param("client_id", KEY_A))
        .and(header("authorization", auth.as_str()))
        .respond_with(ok_json(
            json!({ "url": "https://cf-media.sndcdn.com/x.128.mp3?Policy=p" }),
        ))
        .expect(1)
        .mount(&world.api)
        .await;

    let stream = world.signed_in_client().stream(9).await.unwrap();
    assert_eq!(stream.protocol, StreamProtocol::Progressive);
    assert_eq!(stream.mime_type, "audio/mpeg");
    assert_eq!(stream.url, "https://cf-media.sndcdn.com/x.128.mp3?Policy=p");
    assert!(!stream.preview);
}

#[tokio::test]
async fn a_refused_transcoding_falls_back_to_the_next() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    let api = world.api.uri();
    let mut body = track(9);
    body["media"] = json!({ "transcodings": [
        { "url": format!("{api}/media/t/aac/stream/hls"), "preset": "aac_160k", "snipped": false,
          "quality": "sq", "format": { "protocol": "hls", "mime_type": "audio/mp4; codecs=\"mp4a.40.2\"" } },
        { "url": format!("{api}/media/t/mp3/stream/progressive"), "preset": "mp3_1_0", "snipped": false,
          "quality": "sq", "format": { "protocol": "progressive", "mime_type": "audio/mpeg" } },
    ]});
    Mock::given(path("/tracks/9"))
        .respond_with(ok_json(body))
        .mount(&world.api)
        .await;
    // A rights refusal on playback is not a stale key: no new lookup.
    Mock::given(path("/media/t/mp3/stream/progressive"))
        .respond_with(ResponseTemplate::new(403))
        .expect(1)
        .mount(&world.api)
        .await;
    Mock::given(path("/media/t/aac/stream/hls"))
        .respond_with(ok_json(
            json!({ "url": "https://playback.media-streaming.soundcloud.cloud/x/playlist.m3u8" }),
        ))
        .expect(1)
        .mount(&world.api)
        .await;

    let stream = world.client().stream(9).await.unwrap();
    assert_eq!(stream.protocol, StreamProtocol::Hls);
    assert!(stream.url.ends_with("playlist.m3u8"));
}

#[tokio::test]
async fn a_drm_only_track_is_not_available() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    let mut body = track(9);
    body["media"] = json!({ "transcodings": [
        { "url": format!("{}/media/t/enc/stream/ctr-encrypted-hls", world.api.uri()), "preset": "aac_160k",
          "snipped": false, "quality": "sq",
          "format": { "protocol": "ctr-encrypted-hls", "mime_type": "audio/mp4; codecs=\"mp4a.40.2\"" } },
    ]});
    Mock::given(path("/tracks/9"))
        .respond_with(ok_json(body))
        .expect(1)
        .mount(&world.api)
        .await;

    let error = world.client().stream(9).await.unwrap_err();
    assert_eq!(error.kind(), ErrorKind::NotAvailable);
    assert_eq!(world.api_requests().await.len(), 1, "nothing was resolved");
}

#[tokio::test]
async fn playlists_are_filled_in_and_kept_in_order() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    // Two complete tracks, then stubs for 3..=60 and for 61, which SoundCloud
    // no longer returns.
    let mut entries: Vec<Value> = vec![track(1), track(2)];
    entries.extend((3..=61).map(|id| json!({ "id": id, "kind": "track", "policy": "ALLOW" })));
    Mock::given(path("/playlists/3"))
        .and(query_param("representation", "full"))
        .respond_with(ok_json(json!({
            "id": 3, "kind": "playlist", "title": "Long", "track_count": 61, "tracks": entries,
        })))
        .expect(1)
        .mount(&world.api)
        .await;
    // Answers in reverse order, as `/tracks?ids=` keeps no order either.
    Mock::given(path("/tracks"))
        .respond_with(|request: &Request| {
            let ids: Vec<u64> = request
                .url
                .query_pairs()
                .find(|(name, _)| name == "ids")
                .map(|(_, value)| value.split(',').map(|id| id.parse().unwrap()).collect())
                .unwrap_or_default();
            if ids.len() > 50 {
                return ResponseTemplate::new(400);
            }
            let tracks: Vec<Value> = ids
                .iter()
                .rev()
                .filter(|id| **id != 61)
                .map(|id| track(*id))
                .collect();
            ok_json(Value::Array(tracks))
        })
        .expect(2)
        .mount(&world.api)
        .await;

    let playlist = world.client().playlist(3).await.unwrap();
    let ids: Vec<u64> = playlist.tracks.unwrap().iter().map(|t| t.id).collect();
    assert_eq!(ids, (1..=60).collect::<Vec<_>>());
}

#[tokio::test]
async fn pasted_links_are_normalised_before_resolving() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    Mock::given(path("/resolve"))
        .and(query_param(
            "url",
            "https://soundcloud.com/forss/flickermood",
        ))
        .respond_with(ok_json(track(293)))
        .expect(1)
        .mount(&world.api)
        .await;

    let resolved = world
        .client()
        .resolve("m.soundcloud.com/forss/flickermood/?si=abc#t=0:30")
        .await
        .unwrap();
    assert!(matches!(resolved, Resource::Track(track) if track.id == 293));

    let error = world
        .client()
        .resolve("https://example.com/forss")
        .await
        .unwrap_err();
    assert_eq!(error.kind(), ErrorKind::InvalidInput);
}

#[tokio::test]
async fn a_transcoding_off_the_api_host_is_never_asked() {
    let world = World::new().await;
    world.serve_key(KEY_A).await;
    let mut body = track(9);
    // A payload naming another host must not draw the session (or the key) there.
    body["media"] = json!({ "transcodings": [
        { "url": format!("{}/media/t/mp3/stream/progressive", world.web.uri()), "preset": "mp3_1_0",
          "snipped": false, "quality": "sq", "format": { "protocol": "progressive", "mime_type": "audio/mpeg" } },
    ]});
    Mock::given(path("/tracks/9"))
        .respond_with(ok_json(body))
        .expect(1)
        .mount(&world.api)
        .await;

    let error = world.signed_in_client().stream(9).await.unwrap_err();
    assert_eq!(error.kind(), ErrorKind::NotAvailable);
    for request in world.web_requests().await {
        assert!(!request.url.path().starts_with("/media"), "{}", request.url);
    }
}
