# SoundCloud api-v2 — field notes

The only documentation there is for the API this app depends on. SoundCloud
publishes none of it: it is the internal API soundcloud.com itself calls from
the browser, and no API keys have been issued to third parties since 2015. Any
of it can change overnight.

**Rule:** every route the `soundcloud` crate calls is listed here, with what is
known for sure and what is only believed. When SoundCloud breaks something,
this page is where the fix starts.

Legend: ✅ seen working · 🔒 needs a signed-in token · ⚠️ route confirmed, body
or response shape not yet seen.

---

## Basics

| | |
|---|---|
| Base URL | `https://api-v2.soundcloud.com` |
| Public data | `client_id=<id>` query parameter on every request |
| The user's own data and every write | header `Authorization: OAuth <token>` **plus** `client_id` |
| User agent | a normal desktop browser UA; bot-looking UAs get treated differently |

The token goes **only** to `api-v2.soundcloud.com`. Several routes hand back
URLs on CDNs (`*.sndcdn.com`, `*.soundcloud.cloud`) — those must never see it.

## `client_id`

There is no registration, so the key is read the same way the website gets
it:

1. `GET https://soundcloud.com/` with a browser UA.
2. Collect every `<script src>` that ends in `.js` (they sit on
   `a-v2.sndcdn.com/assets/`, about a dozen of them). The page also loads
   third-party scripts — a consent banner from `cdn.cookielaw.org`, a tracker
   from `dwt.soundcloud.com` — so read only `*.sndcdn.com` bundles: the app
   talks to nobody but SoundCloud.
3. Fetch them **from last to first** — the key is usually in one of the last —
   and look for `client_id` followed by `:` or `=` and a quoted run of 20+
   letters and digits (32 in practice). The same bundle holds other
   `client_id`s (`…apps.googleusercontent.com`, `com.soundcloud.services.siwa`);
   requiring the closing quote right after the run skips them. ✅ 2026-11:
   nine bundles, the key in the last one (~3 MB).
4. Keep it in memory for 24 hours. On a `401`/`403` from a read route, fetch a
   fresh one and retry **once**. If the lookup finds the same key again, the
   refusal was about something else (usually a dead session): don't retry, and
   don't look again on every following refusal.

A bad or missing `client_id` is a plain `401`, the same answer as a missing
token. Never hard-code it, never commit it: it rotates.

## Errors — what a status really means

| Reply | Meaning |
|---|---|
| `400` `{"error": "invalid parameter"}` | A query value the route does not accept, e.g. an unknown search filter value. |
| `401` | Route exists, wants a (valid) token — or the `client_id` rotated. Retry once with a fresh id; a second `401` means the session is over (or, when no token was sent, that the key is refused). |
| `403` with `x-datadome: protected` | **DataDome**, a bot filter in front of SoundCloud, refused the request. Nothing is wrong with the key or the token. See "Writes". |
| `403` on playback of a restricted track | No session was sent. Send the token on both playback hops. A `403` on the second hop is about rights, not the key: don't spend a key lookup on it. |
| `404` | Wrong path **or wrong method**. |
| `415` on a write | The request had no body. Send `{}`. |
| `422` | The body shape is wrong. |
| `429` | Rate limited. Back off. |

The difference between `404` and `401`/`403` is how routes were mapped without
an account: a route that exists answers "who are you?", one that does not
answers "no such thing". On write routes an unauthenticated `403` (DataDome
captcha) is therefore a *positive* result.

## Paging

Two styles, and they are not interchangeable:

- **Cursor** — collections under `/users/…`, `/me/…`, `/stream`: send
  `linked_partitioning=1&limit=200`, follow the absolute `next_href` from each
  reply (add `client_id` again) until it is missing. Some `next_href`s already
  carry a `client_id` of their own (seen on `/tracks/{id}/related` and
  `/tracks/{id}/comments`): strip it before the URL leaves the crate, add the
  current one on use. `limit` above 200 is capped to 200.
- **Offset** — the `/search…` family: `limit` (≤200) and numeric `offset`. Its
  `next_href` is only `…&offset=N`, so expose `offset` to the UI rather than a
  URL. Pages do not overlap. Search can return one item more than `limit`, so
  take the next offset from `next_href` rather than counting.

## Shapes worth knowing

**Track:** `id`, `urn` (`soundcloud:tracks:123`), `title`, `permalink_url`,
`duration` / `full_duration` (ms), `artwork_url`, `user` (nested), `genre`,
`tag_list`, `description`, `created_at`, `playback_count`, `likes_count`,
`reposts_count`, `comment_count`, `waveform_url`, `media.transcodings[]`,
`track_authorization`, `policy`, `monetization_model`, `streamable`,
`downloadable`, `has_downloads_left`, `license`, `label_name`,
`purchase_url` / `purchase_title`.

**User:** `id`, `urn`, `username`, `avatar_url`, `permalink_url`,
`followers_count`, `followings_count`, `track_count`, `description`, `city`,
`country_code`.

**Playlist:** `id`, `title`, `track_count`, `artwork_url` (often `null`),
`is_album`, `set_type`, `user`, `tracks[]`, `duration`, `sharing`. No `urn`
on playlist objects (2026-11): build `soundcloud:playlists:{id}`.

- **Artwork size:** URLs end in `-large` (100px). Swap for `-t500x500` (or
  `-t300x300`, `-original`) for bigger art.
- **Missing artwork:** a track falls back to its uploader's avatar; a playlist
  to its first track's art, then to the owner's avatar. A user without a
  picture has SoundCloud's grey `https://a1.sndcdn.com/images/default_avatar_large.png`
  — treat it as no avatar.
- **`tag_list`** is space-separated, with multi-word tags in double quotes:
  `house "deep house" techno`.
- **`downloadable`** alone is not enough to offer the artist's own file: a
  capped download that ran out still says `true` with
  `has_downloads_left: false`.

---

## Playback ✅

A track carries several `media.transcodings`. Counted over ~550 search
results in 2026-11 — most tracks now come as HLS AAC only, MP3 is the
exception:

| `format.protocol` | `format.mime_type` | `preset` | `quality` | seen on |
|---|---|---|---|---|
| `hls` | `audio/mp4; codecs="mp4a.40.2"` | `aac_96k` | `lq` | nearly every track |
| `hls` | `audio/mpegurl` | `abr_sq` | `sq` | nearly every track |
| `hls` | `audio/mp4; codecs="mp4a.40.2"` | `aac_160k` | `sq` | most, not all (44–89% per query) |
| `progressive` | `audio/mpeg` | `mp3_1_0` / `mp3_0_1` | `sq` | a few tracks; all 14 Go+ previews seen |
| `hls` | `audio/mpeg` | `mp3_1_0` / `mp3_0_1` | `sq` | alongside progressive MP3 |
| `cbc-encrypted-hls`, `ctr-encrypted-hls` | as the `hls` rows | `aac_160k`, `aac_96k`, `abr_sq` | | label releases, often as the **only** ones |

Each also has `snipped` (true for a Go+ preview) and a `url` on
`api-v2.soundcloud.com/media/…`.

Label releases (`MONETIZE` + `AD_SUPPORTED`) are often offered to an
anonymous caller **only encrypted**: 22 of the first 50 results for
"daft punk". There is nothing to play then; say so before the user clicks
(the list payloads carry the transcodings). Whether a session changes that
is not known.

Resolving one into something playable is a second request:

```
GET <transcoding.url>?client_id=<id>&track_authorization=<track.track_authorization>
→ 200 { "url": "<signed CDN url>" }
```

| Transcoding | Resolves to | Notes |
|---|---|---|
| progressive mp3 | `cf-media.sndcdn.com/…128.mp3?Policy=…` | Plain MP3, 128 kbps, supports HTTP `Range`. |
| progressive mp3, Go+ preview | `cf-preview-media.sndcdn.com/preview/0/30/…128.mp3?Policy=…` | The 30-second preview. |
| hls mp3 | `cf-hls-media.sndcdn.com/playlist/…` | m3u8 of raw MP3 frames. |
| hls aac | `playback.media-streaming.soundcloud.cloud/…/playlist.m3u8` | m3u8. |
| hls `abr_sq` | — | **404 (`{}`) on resolve. Skip it.** |
| encrypted hls | `playback.media-streaming.soundcloud.cloud/cbcs/…` | Resolves fine, but it is DRM. Skip it. |

Order of preference: whole track before preview (`snipped: false` first),
then progressive mp3, then hls mp3, then hls aac; within one of those, higher
quality first (`sq` before `lq`, so `aac_160k` before `aac_96k`). **Drop
anything whose protocol or preset says `encrypted`** (`cbc-encrypted-hls` is
FairPlay, `ctr-encrypted-hls` is Widevine/PlayReady): there is no key, so it
would load and play silence. If a resolve is refused, try the next one.

`track_authorization` was not checked on an ordinary public track (the hop
answered `200` without it and with garbage). Send it anyway: the website does.

- The signed URL is short-lived. Resolve right before playing; never cache it.
- The CDN answers `access-control-allow-origin: *`, so the webview can route
  the audio through Web Audio (equaliser) with `crossOrigin="anonymous"`.
- **Send the token on both hops** (`GET /tracks/{id}` and the resolve) when
  signed in. A rights-restricted track answers an anonymous caller `403` even
  from an allowed region; the website plays it because it has a session.
  Believed from one case, not proven.
- A track that comes back with no usable transcoding is "not available here",
  not an error in the app.

### Go and Go+ ✅ (anonymous side)

| field | official Go+ upload | fan re-upload of the same song |
|---|---|---|
| `policy` | `SNIP` | `MONETIZE` |
| `monetization_model` | `SUB_HIGH_TIER` | `BLACKBOX` |
| `duration` | `30000` (the preview) | full length |
| `full_duration` | the song's real length | full length |
| transcodings | all `snipped: true` | `snipped: false` |

Enums as the web app declares them — `monetization_model`: `NOT_APPLICABLE`,
`AD_SUPPORTED`, `SUB_HIGH_TIER`, `BLACKBOX`; `policy`: `ALLOW`, `MONETIZE`,
`BLOCK`, `SNIP`. soundcloud.com shows its Go+ badge exactly when
`monetization_model == "SUB_HIGH_TIER"`, for everyone.

The account's plan is believed to be on `/me` as
`consumer_subscription.product.id`: `consumer-mid-tier` (Go),
`consumer-high-tier` (Go+), `consumer-high-dj-tier` (DJ); missing means free.
Not yet seen signed in. What a subscriber is sent for a Go+ track has not been
seen either — expected: the same track with `snipped: false`.

Downloads: never save a `SUB_HIGH_TIER` track — for a subscriber it would
outlive the plan, for anyone else it is the 30-second preview.

### Waveform ✅

`waveform_url` (from `GET /tracks/{id}`) points at JSON, not an image:

```
GET https://wave.sndcdn.com/<id>.json
→ { "width": 1800, "height": 140, "samples": [11, 86, 91, …] }
```

No key, no token. Only ever fetch it from that host — the URL comes out of a
payload.

---

## Reading

### Resolve a link ✅

```
GET /resolve?url=https://soundcloud.com/artist/track
```

Returns the object itself; `kind` is `track`, `user` or `playlist` (a
playlist with stubs, as below). Check the host is SoundCloud before sending
anything, since links come from the user.

It is picky (2026-11): `www.soundcloud.com`, `m.soundcloud.com`, a trailing
slash and a missing scheme are all `404`. Normalise to
`https://soundcloud.com/<path>` first; the query and fragment are ignored
(drop them — `si` and `utm_*` are share tracking).

**`on.soundcloud.com` short links are a `404` on `/resolve`.** The short-link
host itself answers a plain `GET` with `302` and the full link in `Location`
(with `ref`, `si`, `utm_*` tracking added); an unknown code is a `404`. Read
the `Location` without following it, check it lands on `soundcloud.com`,
then resolve that.

### Tracks ✅

```
GET /tracks/{id}
GET /tracks?ids=1,2,3                        batch, max 50 per request
GET /tracks/{id}/related?limit=30            powers radio and autoplay
GET /tracks/{id}/comments?threaded=0&filter_replies=0
GET /tracks/{id}/likers
GET /tracks/{id}/reposters
GET /tracks/{id}/playlists_without_albums    "in playlists"
GET /tracks/{id}/download                    🔒 the artist's original file
```

`/tracks?ids=` does **not** keep the requested order — re-sort afterwards. It
answers a bare JSON array (not `{ collection }`), and 51 ids is a `400`.
`/related` pages by cursor like the user lists. Comments carry `timestamp`,
milliseconds into the track (absent on untimed ones).

### Playlists ✅

```
GET /playlists/{id}?representation=full
```

⚠️ **Only the first ~5 tracks are complete.** The rest are stubs
(`{ id, kind, policy, monetization_model }`). Fill them in with
`/tracks?ids=` in batches of 50, then put them back in the playlist's order.
Measured: a 478-track playlist came back as 5 full + 473 stubs (and a
479-track one as 5 + 474 in 2026-11). Playlists inside lists
(`/users/{id}/albums`, `/search/playlists`) carry the same 5 + stubs;
`/mixed-selections` sends them with `tracks: []`.

### Users ✅ (all public, `client_id` is enough)

```
GET /users/{id}
GET /users/{id}/tracks              uploads, newest first
GET /users/{id}/toptracks           most played
GET /users/{id}/albums
GET /users/{id}/playlists           albums included, flagged is_album
GET /users/{id}/playlists_without_albums
GET /users/{id}/likes               items: { created_at, kind: "like", track | playlist }, both mixed
GET /users/{id}/playlist_likes      items: { created_at, playlist }
GET /users/{id}/followings
GET /users/{id}/followers
GET /users/{id}/spotlight           pinned; tracks and playlists mixed
GET /users/{id}/relatedartists      "fans also like"
GET /stream/users/{id}/reposts      items carry track | playlist
```

All cursor-paged. `/users/{id}/web-profiles` wants a URN, not a number (`400`
otherwise); unused.

### The signed-in user 🔒

```
GET /me
GET /me/play-history/tracks?limit=200&linked_partitioning=1   items: { played_at, track }
GET /stream?limit=200&linked_partitioning=1                   the feed from people you follow
```

`/me/play-history` without `/tracks` is a `404`; anonymously
`/me/play-history/tracks` answers `401`, so that is the route (2026-11).
✅ Signed in (2026-11-03, through the app) it answers and its items decode
with the current model; the raw `played_at` was not inspected, so keep
accepting both an ISO string and an epoch number.

`/me` is how a token is validated: `200` means good, `401` means dead (after
the one `client_id` retry). The play history repeats a track once per play —
de-duplicate for display. Feed items have `type` = `track`, `track-repost`,
`playlist` or `playlist-repost`.

### Search ✅

```
GET /search?q=…                  everything, interleaved
GET /search/tracks?q=…
GET /search/users?q=…
GET /search/playlists?q=…
GET /search/albums?q=…
GET /search/queries?q=…          autocomplete: [{ output, query }]
```

Replies: `{ collection, total_results, next_href }`. Offset paging (see above).
A blank query should not be sent at all. `/search/queries` ignores `limit`
(nine back for five asked).

Track filters, as query parameters (all ✅ 2026-11):

| parameter | values |
|---|---|
| `filter.genre` | a genre name **in lowercase**: `house`, `deep house`, `r&b & soul` |
| `filter.duration` | `short` `medium` `long` `epic` (under 2 min, 2–10, 10–30, over 30) |
| `filter.created_at` | `last_hour` `last_day` `last_week` `last_month` `last_year` |
| `filter.license` | `to_share` `to_modify_commercially` `to_use_commercially` |
| `filter.content_tier` | `SUB_HIGH_TIER` — what the website's Go+ tab adds |

An unknown value of the fixed-list filters is a `400 {"error": "invalid
parameter"}`. A genre that matches nothing — including the right genre in the
wrong case: `House` finds nothing, `house` finds 3.7 million — comes back as
an empty result, indistinguishable from "nothing found". So reject bad values
before sending, and lowercase the genre.

### Discovery ✅

```
GET /mixed-selections?limit=6
GET /stations/soundcloud:track-stations:{track_id}/tracks?limit=50
GET /stations/soundcloud:artist-stations:{user_id}/tracks?limit=50
GET /recent-tracks/{tag}
```

- `/mixed-selections` is the website's home page: rows, each
  `{ urn, title, items: { collection } }` where the items are playlists. Skip
  rows that carry anything else. Signed out (2026-11) there are three:
  "Artists to watch out for" and "Curated by SoundCloud" hold playlists;
  "Trending by genre" holds `system-playlist` items (`soundcloud:system-playlists:trending-by-genre:…`),
  which need routes of their own — skipped.
- Stations return `{ collection: [track] }` once, **no paging**, and ignore
  `limit` (48 back for 5 asked). The station object itself
  (`/stations/{urn}`) is a `404`; only `/tracks` works.
- `/charts` is **dead** (`404`). Genre browsing is `/recent-tracks/{tag}`.

### Notifications 🔒 ⚠️

```
GET /activities
```

Every other spelling 404s (`/notifications`, `/me/activities`, …). Items have
`type` (`track`, `playlist`, `track-repost`, `playlist-repost`, `comment`,
`favoriting`, `affiliation`), a `user` and an `origin`. Decode `origin` by its
**own `kind` field**, not by guessing from its shape — a track and a comment
look alike enough to be confused. No "mark as seen" route has been found;
track unread state locally.

### Messages 🔒 ⚠️

Keyed on the pair of user ids (the website's URL is `/messages/{me}:{other}`).

| | route |
|---|---|
| inbox | `GET /users/{me}/conversations` |
| unread count | `GET /users/{me}/conversations/unread` |
| one thread | `GET /users/{me}/conversations/{other}/messages` |
| mark read / unread | `PUT /users/{me}/conversations/{other}` |
| delete thread | `DELETE /users/{me}/conversations/{other}` |
| send | `POST /users/{me}/conversations/{other}` — blocked for us, see "Writes" |

Bodies have never been seen: decode every field as optional and accept several
spellings (`content` / `body` / `message`, `sender_urn` / `sender_id`) so an
unexpected key degrades instead of failing. A message can carry a `track`.

---

## Writes 🔒

```
PUT    /users/{me}/track_likes/{track_id}        like a track
DELETE /users/{me}/track_likes/{track_id}        unlike
PUT    /users/{me}/playlist_likes/{playlist_id}  like a playlist or album
DELETE /users/{me}/playlist_likes/{playlist_id}
POST   /me/followings/{user_id}                  follow   (PUT is a 404)
DELETE /me/followings/{user_id}                  unfollow
PUT    /me/track_reposts/{track_id}              repost
DELETE /me/track_reposts/{track_id}
PUT    /me/playlist_reposts/{playlist_id}
DELETE /me/playlist_reposts/{playlist_id}
POST   /tracks/{id}/comments                     ⚠️ body believed {"comment":{"body","timestamp"}}
DELETE /comments/{id}
PUT    /playlists/{id}                           edit (title, sharing, tracks)
DELETE /playlists/{id}
POST   /playlists                                ⚠️ create, body believed {"playlist":{"title","sharing","tracks"}}
```

`{me}` is the signed-in user's numeric id (from `/me`) — cache it, and forget
it when the token changes. Wrong guesses that cost real bugs before:
`PUT /likes/tracks/{id}` and `PUT /me/followings/{id}` are both `404`, and
`POST /reposts/tracks/{id}` (captioned repost) is a `404` too.

Every write needs **a body** (even `{}`, or it is `415`), gets the same
one-time `client_id` retry as reads, and should carry
`Origin: https://soundcloud.com` and `Referer: https://soundcloud.com/`.

⚠️ **Playlist edit is a foot-gun.** `PUT /playlists/{id}` replaces the whole
track list: a `"tracks": []` in the body empties the playlist. A rename must
not send `tracks` at all.

### DataDome — why writes may fail anyway

Writes sit behind **DataDome**, a bot filter that the read routes do not have.
A refused write answers `403` with `x-datadome: protected` (and sets a
`datadome` cookie). Measured with an otherwise-working client:

| request | result |
|---|---|
| like, no cookie | `403` DataDome |
| like + the browser's real `datadome` cookie | `403` DataDome |
| like + cookie + a complete Firefox header set over HTTP/2 | `403` DataDome |
| `GET /tracks/{id}`, same client | `200` |

So it is not headers or cookies: the filter fingerprints the **TLS
handshake**, and a Rust HTTP client does not look like a browser there.
Report it to the user as "SoundCloud's bot protection refused this", never as
a bad key or an expired login — that sends them fixing what is not broken.

Ways out, none tried yet:

1. Make the write from a webview on soundcloud.com's own origin (a real
   browser engine, real handshake; a person solves the captcha once). It cannot
   be a `fetch` from the app's own page: CORS only allows
   `https://soundcloud.com`.
2. Impersonate a browser's TLS fingerprint — a heavy dependency and an arms
   race.
3. Open the page in the user's browser and let them click.

---

## Sign-in

There is no OAuth flow to implement (no app registration). The session the
website creates is reused: after sign-in soundcloud.com sets an
**`oauth_token` cookie**, and that value is the token.

Ways to get it:

1. **A webview window** showing `https://soundcloud.com/signin`; once the
   cookie appears, read it from the webview's cookie store (it is HttpOnly, so
   page JavaScript cannot see it — the native cookie API can). Works on macOS
   (WKWebView passes the captcha). On Linux, WebKitGTK tends to get an
   unsolvable captcha. On Android the WebView is Chromium and usually passes;
   drop `; wv` from its user agent and touch nothing else.
2. **The user's own browser**: open soundcloud.com there, then read
   `oauth_token` from its cookie database. Firefox-family browsers keep it in
   plain SQLite (`cookies.sqlite`). Safari's file is readable only with Full
   Disk Access. Chromium-family browsers encrypt cookies with a key in the OS
   keychain — out.
3. **Paste**: the user copies `oauth_token` from DevTools. Always works.

Validate any token with `GET /me` before storing it. Store it in the OS
keyring only.

How the app does way 1 (`src-tauri/src/signin.rs`, 2026-11): a separate
window labelled `signin` opens `https://soundcloud.com/signin` as an
**incognito** webview (nothing of the session stays in it, so switching
accounts works), with a current Safari user agent on macOS so Google and Apple
sign-in do not refuse an embedded webview. No capability names that window,
so the remote page cannot call the app. An async command polls the window's
cookie store every ~600 ms for `oauth_token` on `soundcloud.com` and
`m.soundcloud.com` (accepting only that domain and its subdomains), checks the
value with `/me`, stores it, and closes the window. A value `/me` refused is
not tried twice; closing the window ends the wait. Reading cookies happens
off the main thread: on Windows it deadlocks there. Not yet tried against a
real account.

Phones are redirected to `m.soundcloud.com`, where the cookie is set
host-only — look for it on that host as well, or the sign-in never "finishes".

---

## Beyond SoundCloud: lyrics (LRCLIB)

SoundCloud has no lyrics. [LRCLIB](https://lrclib.net) is free and needs no
key:

```
GET https://lrclib.net/api/get?artist_name=…&track_name=…&duration=<seconds>
GET https://lrclib.net/api/search?q=…
```

Reply: `{ syncedLyrics, plainLyrics }`; synced lyrics are LRC
(`[mm:ss.xx] line`). SoundCloud titles are messy, so strip bracketed noise
(`(Official Video)`, `[Free DL]`) and a leading `Artist - ` before asking, and
fall back from `get` to `search`. No result is normal for remixes and DJ sets,
not an error.

## Still unknown

- Message and comment bodies — needs one signed-in session watched in DevTools.
- How `client_id` gets rate-limited, and when.
- What a Go+ subscriber receives.
- Whether a session gets unencrypted streams for label releases that an
  anonymous caller is offered only encrypted.
- Uploading tracks (a policy → S3 → create flow; routes not found by guessing).
- Blocking or reporting a user (`/users/{id}/block` is a 404).
