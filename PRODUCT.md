# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily the author and people like them: SoundCloud listeners with a big
personal library — over a thousand likes, many playlists, a lot of it
re-uploads with messy titles — who keep music on for hours while doing
something else (homework, coding, drawing, games). Many listen to
Russian-language music, so Cyrillic titles, transliterated titles and mangled
mixes of both are everyday content.

The job: start their own music within a second, let it run in the background,
and steer it without stopping what they are doing.

## Product Purpose

An unofficial desktop client for SoundCloud (later Android too) that plays
your own library — likes, playlists, albums, reposts, followings, stations,
history, downloads — and keeps playing after it runs out with a personal
endless selection built from your own listening, like Yandex Music's «Моя
волна». Success: opening the app means music is playing, the library is a
pleasure to dig through, and nothing about it is slower or flakier than the
website.

## Positioning

The website cannot do any of this, and a neighbour client could not truthfully
claim all of it:

- a small native app instead of a browser tab: no ads, no tab, starts fast;
- works with no network: downloaded tracks play anywhere, and the app stays
  usable signed in and offline;
- a better-looking interface of its own;
- features SoundCloud lacks: a listening diary, a 10-band equaliser,
  synced lyrics, offline search with transliteration (`vyazki` finds «Вязки»),
  real artist names and covers for re-uploads, and a selection that learns from
  your complete listening history — which only you have.

## Operating Context

- Runs as a desktop app (Tauri: a native window around a web interface). The
  Mac is the main machine; Windows and Linux builds follow; Android later.
- It plays for hours, mostly as a background window. Media keys, the lock
  screen / Now Playing, the menu bar and hotkeys matter as much as the window.
- Keyboard-driven use is expected: hotkeys everywhere, a Cmd/Ctrl-K command
  palette.
- Sometimes on a plane or a train: offline is a normal state, not an error.
- Libraries are large: lists of 1,000–5,000 tracks must scroll and filter
  instantly.

## Capabilities and Constraints

- Uses SoundCloud's undocumented internal API (`api-v2`); it can break without
  warning. One broken feature must never take the whole app down.
- Sign-in reuses the website's session token (webview sign-in, browser cookie,
  or pasted token). The token lives in the OS keyring only.
- Writes (like, repost, follow) can be refused by SoundCloud's bot filter
  (DataDome). The app says so honestly; it never fakes success.
- Go+ tracks play as 30-second previews for non-subscribers; region-blocked
  tracks do not play. Both should be visible before pressing play.
- Messages and notifications are read-only (sending is closed to third
  parties).
- Talks only to SoundCloud and LRCLIB (lyrics). Optional, off by default: an
  AI provider the user brings a key for (OpenAI-compatible, Anthropic, or a
  local Ollama), weather for context. No own server, no telemetry.
- Interface in Russian and English first; more languages later. Fonts ship
  inside the app (no CDNs), with Cyrillic.
- Distributed only through GitHub releases, never the App Store or Google
  Play.
- Undecided: how the personal selection («волна») is scored beyond SoundCloud's
  own related tracks and stations; how much appearance customisation returns
  after the old app's five skins and twenty palettes were removed.

## Brand Commitments

- Name: **Cloudify**.
- Required disclaimer wherever the app describes itself: "Unofficial client.
  Not affiliated with SoundCloud. Use at your own risk."
- This is a from-scratch rewrite. None of the first app's visual systems —
  the five skins (One, Nit, Editorial, Studio, Obsidian), "Relief", "Signal
  Grid", the "Nit" waveform strip — carry over. They are evidence of what was
  tried, not a reference.
- Do not imitate SoundCloud's own branding (its orange, its logo).
- **Look and feel: like Yandex Music** (its «Моя волна» / My Vibe screen),
  chosen by the user on 2026-11-02 after rejecting light, retro and
  instrument-style concepts: a black ground, a living colour "blob" as the
  centrepiece of the wave, very large bold type, a calm left sidebar, a column
  of wave suggestions with real artwork. Yandex Music's craft level is the
  bar. Its brand marks (the star logo, its signature yellow, its name) are not
  copied — Cloudify keeps its own name, mark and colours.

## Evidence on Hand

- The feature inventory: `docs/features.md` (Russian), including the author's
  backlog of future work.
- Real content is whatever the user's SoundCloud account holds; for mockups,
  public SoundCloud data (titles, artists, artwork) can stand in.
- No screenshots, users, reviews or press exist for the new version. Do not
  invent any.
- No logo or icon exists for the new version yet (the template icon is a
  placeholder).

## Product Principles

1. **Your music first.** Opening the app leads straight to playing your own
   things; discovery comes second.
2. **Honest states.** Say exactly why something does not work — region, Go+,
   bot filter, offline, expired sign-in — and never offer "try again" when
   trying again cannot help.
3. **Calm in the background.** It is on for hours: nothing blinks, nags or
   competes with what the user is actually doing.
4. **Local and private.** Everything the app learns stays on the machine;
   anything that leaves it is opt-in and shown.
5. **Full without extras.** No feature is locked behind an AI key or a
   subscription the app controls; rules first, models only improve.
