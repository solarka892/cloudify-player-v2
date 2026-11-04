---
name: Cloudify
description: An unofficial SoundCloud desktop client where the only colour is the music that is playing.
colors:
  ground: "#08080a"
  panel: "#121215"
  panel-hover: "#18181c"
  dock: "#0c0c0f"
  line: "rgb(255 255 255 / 0.08)"
  fg: "#f4f4f6"
  fg-muted: "rgb(244 244 246 / 0.62)"
  fg-faint: "rgb(244 244 246 / 0.5)"
  ink: "#0b0b0d"
  glow-1: "#ff9d6b"
  glow-2: "#ff4fa3"
  glow-3: "#6b7bff"
  smoke: "rgb(10 10 12 / 0.62)"
  smoke-hover: "rgb(40 40 46 / 0.72)"
  rim: "rgb(255 255 255 / 0.16)"
  veil: "rgb(255 255 255 / 0.07)"
typography:
  display:
    fontFamily: "Unbounded Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "min(132px, 15cqi)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Unbounded Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(64px, 8vw, 112px)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.055em"
  section:
    fontFamily: "Unbounded Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.45
  title:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.4
    fontFeature: "\"tnum\""
  badge:
    fontFamily: "Manrope Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: 1
rounded:
  hairline: "2px"
  sm: "4px"
  key: "7px"
  thumb: "9px"
  md: "12px"
  art: "14px"
  menu: "16px"
  tile: "18px"
  card: "22px"
  cover: "26px"
  pill: "9999px"
spacing:
  chip-gap: "8px"
  action-gap: "12px"
  card-pad: "16px"
  section-gap: "18px"
  gutter-tight: "28px"
  grid-gap: "32px"
  grid-row-gap: "40px"
  wall-gap: "24px"
  wall-row-gap: "28px"
  gutter: "56px"
components:
  button-primary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "54px"
    padding: "0 26px 0 20px"
  button-round:
    backgroundColor: "{colors.smoke}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    size: "54px"
  button-round-hover:
    backgroundColor: "{colors.smoke-hover}"
  chip-mood:
    backgroundColor: "{colors.smoke}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 15px"
  chip-mood-selected:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
  nav-tab:
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 16px"
  nav-tab-current:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.fg}"
  input-search:
    backgroundColor: "{colors.veil}"
    textColor: "{colors.fg}"
    rounded: "20px"
    height: "40px"
    width: "340px"
    padding: "0 6px 0 16px"
  input-search-focus:
    backgroundColor: "rgb(255 255 255 / 0.1)"
  menu-suggest:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.menu}"
    width: "max(100%, 420px)"
    padding: "6px"
  menu-suggest-item:
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  menu-suggest-item-active:
    backgroundColor: "rgb(255 255 255 / 0.06)"
    textColor: "{colors.fg}"
  menu-suggest-hit:
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    height: "52px"
    padding: "0 12px"
  card-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  card-panel-hover:
    backgroundColor: "{colors.panel-hover}"
  badge-state:
    backgroundColor: "{colors.veil}"
    textColor: "{colors.fg-muted}"
    typography: "{typography.badge}"
    rounded: "8px"
    padding: "4px 8px"
  chip-section:
    backgroundColor: "{colors.smoke}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 15px"
  chip-section-current:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
  input-filter:
    backgroundColor: "{colors.smoke}"
    textColor: "{colors.fg}"
    rounded: "20px"
    height: "40px"
    width: "340px"
    padding: "0 6px 0 16px"
  input-filter-focus:
    backgroundColor: "{colors.smoke-hover}"
  button-jump:
    backgroundColor: "{colors.smoke}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    size: "40px"
  track-tile:
    backgroundColor: "{colors.panel-hover}"
    textColor: "{colors.fg}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    width: "196px"
  track-tile-play:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "56px"
  track-tile-round:
    backgroundColor: "rgb(10 10 12 / 0.72)"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    size: "36px"
  track-tile-round-hover:
    backgroundColor: "rgb(40 40 46 / 0.9)"
  badge-preview:
    backgroundColor: "rgb(0 0 0 / 0.65)"
    textColor: "rgb(255 255 255 / 0.9)"
    rounded: "6px"
    padding: "4px 6px"
  tile-playlist:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.tile}"
    padding: "10px"
  tile-playlist-hover:
    backgroundColor: "{colors.panel-hover}"
  tile-person:
    rounded: "{rounded.tile}"
    padding: "10px"
  tile-person-hover:
    backgroundColor: "{colors.panel}"
  tile-play:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  menu-floating:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.menu}"
    width: "240px"
    padding: "6px"
  menu-item:
    textColor: "{colors.fg-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  menu-item-hover:
    backgroundColor: "rgb(255 255 255 / 0.06)"
    textColor: "{colors.fg}"
  filter-column:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    width: "240px"
    padding: "14px"
  filter-choice:
    textColor: "{colors.fg-muted}"
    rounded: "10px"
    height: "34px"
    padding: "0 10px"
  filter-choice-on:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.fg}"
  filter-pill:
    backgroundColor: "rgb(255 255 255 / 0.06)"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.pill}"
    height: "30px"
    padding: "0 11px"
  filter-pill-on:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
  switch:
    backgroundColor: "rgb(255 255 255 / 0.16)"
    rounded: "{rounded.pill}"
    width: "36px"
    height: "22px"
  switch-on:
    backgroundColor: "{colors.glow-1}"
  track-row-found:
    textColor: "{colors.fg}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "0 10px"
  track-row-found-hover:
    backgroundColor: "rgb(255 255 255 / 0.05)"
  track-row-round:
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.pill}"
    size: "32px"
  track-row-round-hover:
    backgroundColor: "rgb(255 255 255 / 0.08)"
    textColor: "{colors.fg}"
  aside-cover:
    rounded: "{rounded.cover}"
    width: "clamp(180px, 20cqi, 240px)"
  player-bar:
    backgroundColor: "{colors.dock}"
    height: "84px"
  player-play:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  player-mode:
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.pill}"
    size: "32px"
  player-mode-on:
    textColor: "{colors.glow-1}"
  player-round-open:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.fg}"
  sheet-queue:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    width: "min(430px, calc(100vw - 32px))"
    height: "min(660px, calc(100vh - 180px))"
  queue-row:
    textColor: "{colors.fg}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "56px"
  queue-row-hover:
    backgroundColor: "rgb(255 255 255 / 0.05)"
  sheet-keys:
    backgroundColor: "{colors.panel}"
    padding: "22px 32px"
  keycap:
    backgroundColor: "{colors.veil}"
    textColor: "{colors.fg}"
    rounded: "{rounded.key}"
    height: "26px"
    padding: "0 7px"
  keycap-small:
    height: "22px"
    padding: "0 6px"
  key-drawn:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.fg}"
    rounded: "{rounded.key}"
    size: "34px"
  key-drawn-lit:
    backgroundColor: "{colors.glow-1}"
    textColor: "{colors.ink}"
  status-button:
    backgroundColor: "rgb(255 255 255 / 0.08)"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 15px 0 12px"
  status-button-hover:
    backgroundColor: "rgb(255 255 255 / 0.13)"
  status-button-open:
    backgroundColor: "rgb(255 255 255 / 0.16)"
  status-button-expired:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
  panel-problems:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    width: "min(440px, calc(100vw - 44px))"
    padding: "8px"
  problem-card:
    textColor: "{colors.fg}"
    rounded: "{rounded.menu}"
    padding: "14px 14px 14px 16px"
  problem-card-focused:
    backgroundColor: "rgb(255 255 255 / 0.04)"
  problem-action:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 13px"
  problem-action-hover:
    backgroundColor: "rgb(255 255 255 / 0.16)"
  sheet-expired:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    width: "min(460px, calc(100vw - 44px))"
    padding: "22px 22px 20px"
  button-sign-in-again:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "46px"
    padding: "0 22px 0 18px"
  held-pill:
    backgroundColor: "rgb(10 10 12 / 0.86)"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px 0 12px"
  chip-setting:
    backgroundColor: "rgb(10 10 12 / 0.66)"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 15px"
  chip-setting-open:
    backgroundColor: "{colors.smoke-hover}"
  day-strip-day:
    textColor: "{colors.fg-faint}"
    rounded: "8px"
    height: "52px"
    width: "26px"
  day-strip-day-current:
    backgroundColor: "rgb(10 10 12 / 0.66)"
    textColor: "{colors.fg}"
  part-block:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    padding: "6px"
  part-play:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "36px"
  play-row:
    textColor: "{colors.fg}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "0 10px"
  play-row-hover:
    backgroundColor: "rgb(255 255 255 / 0.04)"
  button-more:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 12px"
  panel-setting:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.menu}"
    width: "340px"
    padding: "8px"
  panel-option:
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  panel-option-checked:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.fg}"
---

# Design System: Cloudify

## Overview

**Creative North Star: "The Light From the Cover"**

Cloudify is a near-black room with one light source: the cover of whatever is playing. Three hues are read from that artwork, lifted so they glow on a dark ground, and drawn as a soft ribbon of light behind one very large word. Everything else in the window stays neutral, so the music is always the only colour on screen. When the track changes, the whole interface (the light, the progress fills, the mark, the focus ring, the text selection) cross-fades to the new cover over 1.6 seconds.

The window is built for hours of background listening. The light swells with the playing track's real loudness curve, slows to a drift when paused, and costs almost nothing when nobody is looking. Type is big and heavy where it names a place and calm everywhere else. Surfaces are soft, rounded, tonal steps of near-black; actions are white pills and smoky rounds. Real artwork appears wherever a track, playlist or person is shown, and a missing cover is a quiet tile, never a broken image.

The mood is close to a large streaming service's dark "for you" screen in polish and energy, but the layout, names, mark and colours are Cloudify's own. No fixed brand accent exists, and none of SoundCloud's or Yandex Music's brand marks or signature colours are used.

**Key Characteristics:**
- Near-black ground; all colour comes from the playing cover through three live `--glow-*` variables.
- A blurred, grain-covered ribbon of light behind one huge Unbounded word.
- White pill for the primary action; smoky round buttons with a 1 px inner rim for the rest.
- Heavy Manrope (600 and up) for all running text; Unbounded only for names of places.
- Rounded tonal panels instead of borders and shadows.
- Big real covers as the way into music: a wall you point at, and the light takes the hues of what you point at.
- Motion that is slow, soft, cheap at idle, and off under reduced motion.

## Colors

A neutral near-black scale with no accent of its own, plus three colours that the music supplies at run time.

### Primary
- **Cover Glow** (`glow-1`, default warm apricot): the lead hue of the playing cover. It colours the mark, the focus ring, the caret, text selection, the "now playing" title in lists, the liked heart, and the head of every progress fill.
- **Cover Glow Two** (`glow-2`, default hot rose): the second cover hue; the tail of progress fills and waveform bars, and a stop in the ribbon gradients.
- **Cover Glow Three** (`glow-3`, default electric periwinkle): the third cover hue; it lives only in the ribbon.

The three hex values in the frontmatter are the registered initial values shown before any cover has been read. At run time the values come from `coverPalette.ts`: the three most present hues of the artwork, saturation raised by 0.25 and lightness clamped to 52–66 % so they glow on the ground. A cover with fewer hues gets neighbours of its main hue; a colourless cover keeps a warm default.

### Neutral
- **Ground** (`ground`): the window itself, the hero behind the light, and the backing the top bar grows (at 80 % with a strong blur) once the page scrolls under it.
- **Panel** (`panel`): every card, tile, popover and skeleton block.
- **Panel Lift** (`panel-hover`): hover state of panels, and the fill behind artwork while it loads or when it is missing.
- **Dock** (`dock`): the player bar, one step above ground so it reads as a separate floor.
- **Line** (`line`): the hairline on top of the player bar, around floating menus and the sheets that rise over the player (the queue, and the key help on all but its bottom edge), the separators between groups inside the search suggestions and between the diary's keep choices and «Стереть дневник», and the one rule under a wide list's column heads. Nowhere else.
- **Paper White** (`fg`): primary text and icons on hover.
- **Muted** (`fg-muted`): artist names, secondary lines, idle icons, nav tabs at rest.
- **Faint** (`fg-faint`): counts, durations, timestamps, the disclaimer. It is the lowest text tone allowed and is used only for short labels.
- **Ink** (`ink`): text and icons on white pills and the selected chip.
- **Smoke** (`smoke`, `smoke-hover`) with **Rim** (`rim`): the translucent dark fill and 1 px inner rim of everything that sits on the light: secondary round buttons, mood, section and setting chips, the library's and the diary's filter well and its jump round, and the day on screen in the diary's day strip. Over a cover (the heart and «…» rounds on a track tile) the smoke deepens to black at 72 %, 90 % on hover, so the rounds hold up on any artwork.
- **Veil** (`veil`): white at 7 % for wells on ground or panel: the top bar's search field, the token input, the city field in «Где ты», state badges, the keyboard hint, keycaps.

### Named Rules
**The Music Paints Rule.** No component gets a fixed accent colour. Anything that needs emphasis takes `glow-1`/`glow-2` (or white for actions); everything else stays on the neutral scale.

**The No Yellow Turn Rule.** Moods may rotate the cover's hues (`hueShift`), but a rotated hue that lands between 44° and 68° is pushed out to orange or lime. A cover's own yellow is the music's and stays; a yellow the app produces itself is never allowed.

**The Cross-Fade Rule.** Glow colours never jump. They are registered with `@property` and transition over 1.6 s on `:root`; reduced motion switches them instantly.

**The Pointed Light Rule.** A page's own light may borrow colours locally by setting `--glow-*` on its wrapper: first from the cover the pointer or focus rests on (a tile on a wall, or a found track's row), else from the opened playlist or person, else from the artist a search names, else it keeps the playing track's. Pointing answers the hand in 0.6 s after a 70 ms rest (so a sweep across covers does not flicker); everything else crosses over in 1.6 s; leaving the covers gives the light back. Only the light relights: progress fills, focus ring and selection keep the playing track's colours.

**The Smoke On Light Rule.** Anything placed on the light is smoke with a rim, never veil: a white wash vanishes into the light's brightest band. Veil is for wells on ground.

**The Grey Light Rule.** While there is no network or the sign-in has expired, the light from the cover goes grey (`grayscale(1) brightness(0.5)`) on the shell and on the sign-in and unreachable stages, and the colour comes back the same way when they return, both over 1.6 s (instantly under reduced motion). The ribbon keeps moving; only its colour is taken. Nothing else in the window changes colour for it.

## Typography

**Display Font:** Unbounded Variable (with ui-sans-serif, system-ui)
**Body Font:** Manrope Variable (with ui-sans-serif, system-ui)

Both are self-hosted through fontsource, with Cyrillic, and ship inside the app.

**Character:** Unbounded's wide, rounded extra-bold makes one word fill the screen like a poster; Manrope at semibold and heavier keeps every small line sturdy and legible on near-black.

### Hierarchy
- **Display** (Unbounded 800, `min(132px, 15cqi)`, 0.92, −0.055em, single line): the one big word of a full screen: «Подборка», «Cloudify» on sign-in, the offline title. It scales with its container so it never wraps or clips in a 960 px window, and carries a soft dark text shadow to sit on the light. «Библиотека» is the same face one step smaller (`min(108px, 12.5cqi)`), because its actions and chips share the first screen; «Дневник» is that size again, also held to 15vh so a short window still shows plays in its first view.
- **Fitted name** (Unbounded 800, 0.92, −0.055em, same text shadow): the name of an opened playlist or person, and the search page's title (the found artist's name, or the query itself), which can be anything. It is measured, not guessed: one line up to 112 px while that stays at 64 px or more; otherwise balanced over two lines up to 84 px (no smaller than 44 px); a very long name gets three lines at 34–60 px. Never clipped mid-letter, never shrunk to body size.
- **Headline** (Unbounded 800, `clamp(64px, 8vw, 112px)`, 0.92, −0.055em): the title of a section page that is not built yet.
- **Section** (Unbounded 700, 19px, 1, −0.02em): section titles («Продолжить», «Лайки», «Плейлисты»), the key help's «Клавиши», the diary's day dates («Сегодня, 4 ноября», the date after the comma in `fg-muted`), and the wordmark beside the mark; 15px in the titles of the diary's small panels («Сколько хранить», «Где ты»).
- **Lead** (Manrope 600, 17px, 1.45, max 42–52ch): the one line under a display word, in white at 80 % with a soft shadow when it sits on the light. The diary's lead drops to 15px at 1.4 when the window is 700 px tall or less.
- **Title** (Manrope 800, 14–16.5px, about 1.25): track and playlist titles in rows, cards, tiles and the player (14.5px under a track tile and in a found track's row, 14px under playlist and person tiles and in the search suggestions); 19px bold under the hero cover; 15.5px for a diary part's name («Ночь на 4-е», «Утро»).
- **Body** (Manrope 600, 14px, 1.4): the default for everything; nav tabs and secondary buttons go to 700 at 15px.
- **Label** (Manrope 700, 12.5–13.5px, tabular figures): counts, durations, times, timestamps, plan names, helper text; the count inside a section chip (12.5px at 55 %), the match count inside the filter («120 из 1 312»), the line under a playlist, person or station tile; the filter column's group names, genre counts and the found rows' genre, plays and date cells (12.5px faint); in the diary, a play's time, source and ending (12.5px), a day's and a part's facts (13px faint), the sky word (12.5px faint) and the day strip's dates (10.5px).
- **Badge** (Manrope 800, 11px, 1): state badges on rows («Go+ · 30 с», «не в твоём регионе») and the keyboard hint; 10.5px on the Go+ chip that sits on a cover.

### Named Rules
**The Place Name Rule.** Unbounded names places: the hero word, page titles, section titles, the titles of panels and sheets («Клавиши», «Что не так», «Вход устарел», «Сколько хранить», «Где ты»), the diary's day dates and the wordmark. It never sets a track title, a button, a label or a sentence.

**The Heavy Body Rule.** Manrope never drops below 600. Hierarchy among small text comes from weight (600 / 700 / 800) and the three text tones, not from thin weights.

## Layout

A full-height window: the page scrolls under a floating 68 px top bar, and an 84 px player bar is pinned below the scroll area. The window is never narrower than 960 × 600 (1280 × 820 by default); on macOS the top bar starts at 94 px to clear the traffic lights, otherwise at 28 px.

- **Gutter:** 56 px on both sides of every page; 28 px inside the top bar and the player bar.
- **Hero:** a two-column grid, the text column flexible and the cover column `clamp(220px, 21vw, 300px)`, 48 px apart. The text starts at `clamp(88px, 13vh, 112px)` from the top, so it clears the top bar on short windows. Inside the text column the rhythm is 18 px (word to lead), 26 px (lead to actions), 22 px (actions to moods); actions are 12 px apart, chips 8 px.
- **Home grid:** three columns at 400 : 520 : 344 with 32 px gaps («Продолжить», «Лайки», «Плейлисты»). At 1179 px and narrower it becomes two columns with a 40 px row gap: resume and playlists on top, likes across the full width below.
- **Sections:** an 18 px gap from the section title to its content (12 px for track lists, whose rows carry their own padding). Track rows are 50 px tall.
- **Library page:** no side column. The light spans the full width (a 480 px box, the ribbon 420 px tall from 24 px down), and the content sits on it at the 56 px gutter: «Библиотека» from `clamp(88px, 13vh, 104px)` with 24 px below it, then the actions row (the white shuffle pill, the 340 px filter well, the jump round pushed to the far end; 12 px apart), then the section chips (8 px apart, 32 px below), then the content.
- **Diary page:** the library's page on the same light, with no rail and no face. «Дневник» from `clamp(80px, 13vh, 104px)` at `min(108px, 12.5cqi, 15vh)`; the lead 18 px under it (max 60ch); the facts row 22 px under that (8 px apart); then 14 px to the sticky row (the 340 px find well, then the day strip taking all the rest, 12 px apart, no jump round). Days are 36 px apart (the first 24 px under the sticky row, which keeps 12 px of its own below), each header 12 px above its parts, parts 12 px apart. At 700 px tall or less the header tightens so plays show in the first view: lead 10 px under the word, chips 14 px under the lead, 6 px to the row, the first day 16 px under it. A day picked on the strip scrolls in leaving 156 px for the top bar and the stuck row; the day on screen is the last whose top has passed 220 px.
- **Day strip:** one column per day, newest at the right, as many days as fit up to 31 at 30 px a column (26 px wide, 4 px apart). Below three weeks at that width the columns narrow (to 20 px) to keep 21 days; only below that do days drop off. A 1 px divider (white at 12 %, 30 px tall, 4 px either side) stands before each Monday.
- **Search page:** the library's page without a rail, on the same light (see The Answer First Rule): the fitted title from `clamp(88px, 13vh, 112px)` with 24 px below it, one lead line 18 px under it and its actions 26 px under that (12 px apart); a found artist's circular face sits at the right, 40 px from the text. Then the sticky actions row holds the kinds (chips 8 px apart), and the results start 20 px below it. «Всё» is one shelf of the ten best tracks as two columns of rows (32 px apart, five rows each, read down the first column), then shelves of albums (the found artist's own first), playlists and people (people from 150 px). A kind opened in full is a 164 px tile grid, or for tracks a 240 px filter column beside the windowed list, 32 px apart. Choosing a kind scrolls back to where the results start if the page has passed it, leaving 136 px for the top bar and the stuck chips. Results page in by offset (40 tracks, 30 tiles at a time) when the end of the list is within 1 200 px. An artist or playlist opened from the results takes the page's place with a «Поиск» back link, and coming back lands where the results were left.
- **Shelves («Всё»):** one shelf per section, 40 px apart, title 18 px above its row. A shelf is exactly one row of as many items as fit the width, at least 168 px each with 18 px gaps; it never scrolls sideways and never wraps. Its title opens the whole section.
- **Walls (a section in full):** track covers in columns of at least 196 px (six across a 1440 px window), 24 px apart across and 28 px down, the caption included in each row. Playlist, person and station tiles use a 164 px minimum grid with 18 / 20 px gaps.
- **Opened playlist or person:** a back link, the fitted name with its lead line, and the face at the right (`clamp(180px, 20cqi, 240px)`, 40 px from the text, bottoms aligned). The face hides when the content column is narrower than 768 px; the name then takes the full width.
- **Sticky actions:** the actions row (the library's, the diary's find well and day strip, or search's kinds) sticks 68 px from the top, under the top bar, and spans the full width; once the page has scrolled past it, it grows the top bar's backing (ground at 80 %, strong blur) over 200 ms.
- **Player bar:** three columns: now playing at `clamp(180px, 24vw, 320px)`, the transport with the waveform taking all remaining width, then secondary controls and a 92 px volume slider; column gaps `clamp(16px, 2.2vw, 30px)`. At 1100 px and narrower the now-playing column is a fixed 180 px and the volume slider 72 px, so the waveform keeps its room.
- **Sheets over the player:** the queue floats 16 px from the right edge and 12 px above the bar (`bottom: 96px`), `min(430px, 100vw − 32px)` wide and `min(660px, 100vh − 180px)` tall, so it never reaches under the top bar. The key help spans the full width directly on top of the bar (from 84 px up), 32 px side padding, its keyboard at the left and its text 36 px to the right; its key map is one column, two from 1100 px. Only one shows at a time: while the key help is open the queue steps aside and comes back after.
- **Full-screen states** (sign-in, unreachable): the same light centred vertically, content capped at 1100 px, scrolling instead of clipping in a small window, the disclaimer pinned at the bottom.

### Named Rules
**The Windowed Wall Rule.** A wall that can hold thousands of covers keeps only the rows near the screen in the page (two rows of overscan), all rows one fixed height, so 5 000 likes scroll and filter as lightly as one screen. Loading walls show quiet `panel` tiles in the wall's own rhythm.

**The One Row Shelf Rule.** A shelf shows one row that fits the window and nothing more; the rest is one click away through its title, never behind a sideways scroll.

**The Answer First Rule.** A search leads with what it most likely means. An artist becomes the page's hero (name, face, «Радио артиста») only when SoundCloud ranks a same-named account in its top three people and that account is verified or has 5 000+ followers; otherwise the query itself is the title and the tracks are the answer. While typing, a name that starts with what is typed (from three letters) will do. A namesake never takes the hero.

**The Every Name Opens Rule.** An artist's name or face, wherever it is shown (a tile, a row, the player, the home screen, a playlist's lead, the search hero), opens that artist's page: in place of the results while searching, else in the library. A name inside a row or card that plays sits above the row's own play target, so the rest of the row still plays.

**The Read First Rule.** Found tracks are rows, not covers: a found title is read before it is played, and re-uploads come with long, messy names that a caption under a cover cuts short. The wall of covers is for music you already know (the library).

**The Strip Keeps Three Weeks Rule.** The diary's day strip narrows its columns before it shows fewer than 21 days, so the last three weeks are always one glance; it never scrolls sideways.

**The Counted Choices Rule.** A filter offers what the results actually hold. The genre list is the search's own genres as SoundCloud counts them, each with its count, counted with the other filters but not the genre, so a choice never empties the list by surprise; a chosen genre stays listed even when the counts stop naming it. Totals on chips and titles are SoundCloud's estimates and are shown as such, never padded.

## Elevation & Depth

Depth is tonal and luminous, not shadowed. Surfaces step up from ground (`ground` → `dock` → `panel` → `panel-hover`), and the only real "height" is the light: blurred ribbon bands blended with `screen`, covered by film grain at 45 % overlay so the gradients never band. The ribbon's box fades out at its top and bottom 16 %, and a 120 px gradient into ground closes the hero, so the light never shows an edge.

### Shadow Vocabulary
- **Floating menu** (`box-shadow: 0 18px 40px -16px rgb(0 0 0 / 0.8)`): popovers that float over content (the account menu, the search suggestions, «Что не так», the «Вход устарел» sheet, the diary's «Сколько хранить» and «Где ты»), together with a `line` border.
- **Hero cover** (`box-shadow: 0 30px 60px -24px rgb(0 0 0 / 0.8)`): the large cover in the hero, so it lifts off the light.
- **Opened face**: the face beside an opened playlist or person, and a found artist's face on the search page, use the hero cover shadow; they are that cover's twins.
- **Play round over a cover** (`box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.8)` on the 56 px round of a track tile, `0 10px 24px -10px rgb(0 0 0 / 0.8)` on the 44 px round of a playlist or station tile): the white round floats over artwork.
- **Inner rim** (`box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16)`): the edge of smoky buttons, chips and the filter well on the light, the day on screen in the diary's strip, and of the rounds on a cover. It is an edge, not a lift.
- **Sheet over the player**: the queue uses the floating-menu shadow; the key help, which rises from the bar's full width, throws it upward (`box-shadow: 0 -24px 60px -20px rgb(0 0 0 / 0.8)`).
- **Dragged row** (`box-shadow: 0 18px 40px -12px rgb(0 0 0 / 0.85)` with the inner rim): the ghost of a queue row held by its grip, on `panel-hover`, floating over the list.
- **Key edges** (`inset 0 -1px 0 rgb(255 255 255 / 0.06)` on a keycap; `inset 0 -2px 0` in `glow-1` at 70 % on a drawn key that does something): a bottom edge, not a lift.
- **Status ping** (`box-shadow: 0 0 0 6px` in `glow-1` at 35 %, widening to 14 px as it fades, with a 1.08 scale, over 900 ms): the status button when an action fails. A ring that fades, not a lift; none under reduced motion.
- **Now playing ring** (`box-shadow: 0 0 0 3px var(--glow-1)`): the cover of the playing track on a wall or shelf. A ring in the music's colour, not a lift.
- **Text on light** (`text-shadow: 0 10px 50px rgb(0 0 0 / 0.35)` on display, `0 2px 16px rgb(0 0 0 / 0.4)` on the lead): keeps type readable whatever colour the light takes.

### Named Rules
**The Tonal Step Rule.** Cards and tiles are flat panels; they never get a drop shadow. A shadow means the thing is floating over other content (a menu, a sheet over the player, a dragged row, a white play round over artwork) or is the hero cover and its twin, the opened face.

**The Grain Over Light Rule.** Any surface that shows the ribbon also carries the grain overlay.

**The Cheap Light Rule.** The ribbon redraws at about 30 fps while playing and 15 fps while paused, paints into a canvas a quarter of its drawn size (the light is all soft edges, so stretching it costs nothing visible), stops when it is off screen or the window is hidden, and does not animate at all under reduced motion. Mood changes ease in over roughly half a second.

## Shapes

Everything is round. Interactive controls are full pills or circles; containers use large soft radii that shrink as they nest: hero cover and an opened playlist's face 26 px, cards, the diary's part blocks and empty panel, the sheets over the player and the panels under the status button 22 px (the key help only at its top corners), tiles and section notices 18 px, popovers (the diary's two panels too) and the cards inside «Что не так» 16 px, artwork inside a card 14 px, track covers on walls and shelves, inner controls, menu items, row highlights and mosaics 12 px, filter choices 10 px, list thumbnails 9 px, badges and the day strip's columns 8 px, keycaps and drawn keys 7 px, the Go+ chip on a cover 6 px. People are always circles: a followed or found artist's tile, an opened or found artist's face, and an artist among the search suggestions. Progress tracks, waveform bars and the diary's heard-bars are 4 px and 2 px rounded strips; the day strip's bars are 10 px wide with 3 px top corners. Mosaics clip four covers into one rounded square. The mark is a single rounded stroke: one swell of a sound wave.

## Components

### Buttons
Confident and soft: big pills, quick spring on press.
- **Shape:** full pill or circle (9999px).
- **Primary:** white fill, ink text, Manrope 800 at 16px, 54 px tall with an icon on the left. One per region; it is the action the screen exists for («Слушать подборку», «Войти через SoundCloud»).
- **Hover / Active:** scales to 1.03 on hover and 0.97 on press over 150 ms; disabled drops to 50 % opacity and stops scaling.
- **Round secondary:** 54 px circle (or a 54 px pill with a label), smoke fill with the 1 px inner rim, white icon; hover deepens the smoke. Used beside the primary pill on the light.
- **Player play:** a 44 px white circle with ink icon; scales to 1.05 / 0.95.
- **Icon button:** 32 px circle, no fill, `fg-muted` icon that goes to `fg` on hover. Controls that do not work yet are disabled at 40 % with a title saying "скоро", never hidden behind fake behaviour.
- **Mode round:** an icon button that is a mode (shuffle, repeat). On, its icon is `glow-1` with a 4 px `glow-1` dot just under it; off, it is a plain icon button. A round that opens a panel (the queue) instead sits on a white-10 % circle with a white icon while the panel is open.
- **Quiet text button:** «Все» and «Ещё раз»: muted bold text, or a 32 px white-10 % pill.
- **Focus:** a 2 px `glow-1` outline at 3 px offset everywhere.

### Chips
- **Style:** 36 px pills, smoke fill with the inner rim and a 6 px backdrop blur, Manrope 700, white at 90 %.
- **State:** the selected mood turns solid white with ink text and drops the rim. One is always selected.
- **Section chips:** the library's sections («Всё», «Лайки», «Плейлисты», …) in the same material, each with its count after the name in label figures at 55 %, filled in as each list arrives; sections that are made, not stored (stations, history) carry no count. The current section is white. They navigate (`aria-current`), they are not toggles.
- **Setting chips (diary):** «Хранить всегда» and «Свет и темнота: Москва» in the same material, a 16 px icon before the words and a 15 px chevron at 70 % after; they open a panel (`aria-expanded`), and while it is open the smoke deepens. A place guessed from the time zone adds «· по часовому поясу» at 60 %. Disabled at 50 % until the settings are read.
- **Kind chips (search):** «Всё», «Треки», «Люди», «Плейлисты», «Альбомы» in the same material and the same count anatomy; the counts are SoundCloud's totals for this search.

### Cards / Containers
- **Corner Style:** 22 px for cards, 18 px for tiles.
- **Background:** `panel`, lifting to `panel-hover` on hover over 150 ms.
- **Shadow Strategy:** none (see The Tonal Step Rule).
- **Border:** none.
- **Internal Padding:** 16 px for cards, 10 px for playlist tiles.
- **Empty states** use the same panel with muted 13.5px text that says exactly why. **Failed** parts do not: they keep their own shape (see Held Part), and what to do about them lives in «Что не так».

### Inputs / Fields
- **Style:** veil fill (white at 7 %), no border; the search field is a 340 px, 40 px pill-like well (20 px radius) with a search icon and, while empty, the keyboard hint; the token field is 44 px with 12 px corners.
- **Focus:** the search well brightens to white at 10 %; other fields show the `glow-1` outline. The caret is `glow-1`.
- **Filter well (on the light):** the same 40 px, 20 px-radius well, but smoke with the inner rim (see The Smoke On Light Rule); on focus the smoke deepens. Inside, after the text: the match count while filtering («120 из 1 312») and a 28 px clear round once there is text. ⌘F / Ctrl+F jumps into it; Escape empties it.

### Navigation
- **Style:** three text tabs in the top bar, Manrope 700 at 15px, 38 px pills.
- **States:** muted at rest, white on hover; the current tab gets a white-10 % pill and white text. While the search page is open no tab is current; pressing a tab leaves the search.
- **Top bar:** transparent over the light, growing an 80 % ground backing with a strong backdrop blur once the page scrolls more than 8 px. The whole bar is a window drag region.

### Search Field and Suggestions
The top bar's search is live: it opens the search page, and the field always shows what that page searched.
- **Field:** the veil well above; once there is text the keyboard hint gives way to a 28 px clear round (white at 10 % on hover). ⌘K / Ctrl+K jumps in and selects the text; Escape closes the list, then puts back the searched text, then leaves the field.
- **Suggestions list:** a floating menu 48 px under the field's top, aligned to its right edge, at least 420 px wide (`panel`, `line` border, 16 px corners, 6 px padding, floating-menu shadow). It asks 150 ms after typing stops. Three groups, a 1 px `line` between them: up to six of SoundCloud's completions (a search icon, the typed part as typed and the rest in white 800); then what was found at once in 52 px rows with a 36 px picture (a circle for the artist, 9 px corners for a track), a 14px 800 name and a 12.5px faint line («Артист · 34 842 подписчика», «Трек · Artist»): the artist (see The Answer First Rule) and two playable tracks, or three without an artist; last, «Искать «…»» with a `glow-1` return icon. Rows are 40 px, 12 px corners, bold muted 14px; the active row (pointer or arrows) is white at 6 % with white text. A found track plays straight away; the artist opens in place of the results.
- **Empty field:** the same list offers the last eight searches («Недавние», with «Забыть» to clear them), kept on this computer.
- **Combobox:** the field keeps the focus and the keyboard; arrows move through every row, Enter runs the active one or searches the text.

### Filter Column
The track filters beside the full list, like soundcloud.com's, in Cloudify's material: one 240 px `panel` with 22 px corners and 14 px padding, sticky 140 px from the top (under the top bar and the stuck chips) and never taller than the window above the player, scrolling inside itself.
- **Groups:** «Жанр», «Длина», «Когда добавлен», «Лицензия», each named in 12.5px faint bold, 12 px apart.
- **Choice rows** (genre, licence): 34 px, 10 px corners, bold 13.5px muted; hover white at 6 %, on white at 10 % with white text and a `glow-1` check. Genres carry their count in faint 12px figures (see The Counted Choices Rule); the first row is «Любой» / «Любая». Loading genres are quiet bars.
- **Pills** (length, when added): 30 px pills, white at 6 %, bold 13px muted, 6 px apart; the chosen one is white with ink text. The first pill is «any»; pressing a chosen pill lets it go.
- **Go+ switch:** a 40 px row «Только Go+» with a 36 × 22 px track (white at 16 %, `glow-1` when on) and a 16 px white knob.
- **Reset:** once anything is chosen, a 32 px white-10 % pill «Сбросить фильтры» closes the column.
- Choosing a filter shows «Треки» in full; the list's count then reads «нашлось N».

### Track Tile
A track as its big cover: square, 12 px corners, `panel-hover` while loading. The title (Manrope 800, 14.5px) and the artist (muted 13px, a link to the artist) are always shown under it, never only on hover.
- **Hover / focus anatomy:** the cover scales to 1.04 over 300 ms; a black veil at 35 % comes up; a 56 px white play round appears in the centre (pause when it is the playing track); a heart round and a «…» round (36 px, deep smoke with the rim) rise 4 px into the bottom-right corner. All of it also shows on keyboard focus, and stays while the menu is open. The veil and play round are pointer-transparent: the cover itself is the play button.
- **Now playing:** the cover gets the `glow-1` ring, a small `AudioLines` round at the top right (dimmed when paused), and the title turns `glow-1`. A liked heart is filled `glow-1`.
- **Go+ preview:** a «Go+ · 30 с» chip at the top left of the cover.
- **Unplayable:** the cover drops to 35 % and its caption to 45 %, the cover is disabled and shows no play round, and the second line is the reason (faint) instead of the artist.

### Shelves
A section on «Всё» is a shelf: its title in Section type, the count in faint label figures, and a chevron, all one button that opens the whole section; on hover the chevron moves 2 px right and turns white. Under it, exactly one row of track tiles or of playlist, person or station tiles.

### Playlist, Person and Station Tiles
Things you open rather than play.
- **Playlist (and album):** an 18 px `panel` tile with 10 px padding, a 12 px-cornered mosaic, title and a faint line («38 треков», «Альбом · Artist»); lifts to `panel-hover`. The whole tile opens the playlist; a 44 px white play round rises into the cover's corner on hover or focus (a spinner while it starts) and plays straight away.
- **Person:** no panel at rest, a circular face, name and a faint line; hover shows the `panel` behind it. Opens the artist.
- **Station:** a playlist-style panel tile with the artist's face as a square cover; pressing anywhere plays the radio, and the white round shows it.

### Library Actions Row
The white shuffle pill («Перемешать все 1 574», which shuffles every like, not the loaded ones), the filter well, and at the far end a 40 px smoke jump round that appears only on pages at least four screens long and points toward the further end. A page with its own way around leaves the round out: the diary's row is its find well and its day strip. On an opened item the pill is that item's own action («Слушать», «Радио артиста») with 54 px smoke rounds beside it. The row sticks under the top bar and grows its frosted backing once stuck.

### Opened Item Header
A back link to the section it came from (32 px, white at 75 % with a chevron; a white-10 % pill on hover), then the fitted name, then one lead line (17px, white at 80 %, max 60ch) saying what it is and how much of it there is. On wide stages the face sits at the right: a playlist's mosaic with 26 px corners, an artist's face as a circle, both with the hero cover shadow. The page's light takes this face's colours. Someone else's playlist names its author in the lead, and the name opens them. On the search page the found artist's header is a way in: the fitted name (underlined on hover) and the face (lifting to 1.03) both open the artist's page.

### Floating Track Menu
From a tile's «…» round: a 240 px `panel` with a `line` border, 16 px corners, 6 px padding and the floating-menu shadow, opening below the round or above it when the player bar is in the way. Items are 40 px rows with an 18 px icon and bold muted text, 12 px corners, white at 6 % with white text on hover or focus. Focus lands on the first item; Escape, a click elsewhere, a resize or any scroll closes it.

### Track Row
50 px rows: a 44 px thumbnail (9 px corners), title in Manrope 800 with the artist below in muted 13px, an optional state badge, and the full duration in faint tabular figures. Hover tints the row white at 5 %. The playing track's title turns `glow-1`. A track that cannot play is disabled with its art and text at 40 %, and its badge says why before anyone presses play.
- **Found track row (search):** 56 px, 10 px side padding, 12 px between parts, 12 px corners. The whole row plays (pause when it is the playing track); on hover or focus the 44 px thumbnail takes a black veil at 45 % with a white play glyph, and at the right a heart and a «…» (32 px bare rounds, muted, white at 8 % on hover) appear before the duration (faint tabular figures, 44 px). The heart stays shown when liked (filled `glow-1`), the «…» while its menu is open, and the row keeps its tint meanwhile. The title is 14.5px 800 on one line with its full name as a tooltip; under it the state badge, then the artist as a link that opens them. Pointing at a row relights the page (The Pointed Light Rule).
- **Best rows (two columns):** on «Всё» the ten best found tracks as two columns of these rows, 32 px apart, read down the first column and then the second.
- **Wide windowed list:** «Треки» in full. Over it a row of column heads in 12.5px faint («Трек», «Жанр», «Слушали», «Добавлен», «Длина») on a `line` rule; each row adds genre (150 px), plays (92 px) and the day it was added (104 px) as the list's width allows (from 576, 672 and 768 px of list width: plays, then date, then genre). Only rows near the screen exist (56 px rows, eight rows of overscan), so a list paged two thousand deep scrolls like its first page; loading rows are quiet `panel` shapes in the same rhythm.

### The Ribbon (signature)
Three stroked bands (130, 70 and 26 px wide in a 1440 × 440 drawing), blurred by 48 and 26 px, drawn in two gradients across `glow-2`, `glow-1` and `glow-3`, blended with `screen`, painted into a quarter-size canvas and stretched. Their swell follows the playing track's loudness curve; moods set energy (height), pace (speed) and a hue turn. It reads its colours from its own element, so a wrapper that sets `--glow-*` relights it without touching the rest of the window. It sits behind the hero (440 px tall, from 40 px below the top), behind the library (420 px, under a 480 px grain box) and behind the full-screen states, always with grain and faded edges.

### Player Notice
Under the playing title the player names the artist, and the name opens their page. The line under the playing title in the player bar can carry a short notice («Дальше: …», «Ссылка на трек скопирована») in white instead of the artist, for 7 seconds. It may carry one action that takes back what it reports («Вернуть»), set in Manrope 800 `glow-1`, underlined on hover; pressing it clears the notice. Taking a track out of the queue («Убрал «…»»), taking a play out of the diary («Убрал из дневника: …») and clearing what is next all report here with «Вернуть»; nothing asks for confirmation first.

### Waveform Seek
The player's progress bar is the playing track's real waveform: 4 px bars with 2 px gaps, 8–34 px tall, the played part filled with a `glow-1` → `glow-2` vertical gradient and the rest white at 18 %. It is a keyboard slider (arrows ±5 s, Page keys ±30 s). Without a waveform it draws a quiet even line.

### Player Bar
The 84 px `dock` floor. Now playing at the left: a 56 px cover (12 px corners), the title in Manrope 800 at 15px, and under it the artist (a link) then « · » and where the queue came from, both muted 13px; the artist keeps its room and the source label is the one that truncates. The transport: shuffle, back, the 44 px white play round, next, repeat, 6 px apart, with shuffle and repeat as mode rounds (repeat cycles off → queue → track; repeat-one shows the repeat icon with a 1). Shuffle is disabled for the endless selection, which is already mixed, and its title says so. Then times in faint tabular figures around the waveform. At the right: heart, lyrics, the queue round (lit while the queue is open), mute and volume, 10 px apart. Every control's title names its key («Перемешать (S)», «Очередь (Q)»).

### Queue Sheet
«Дальше»: the queue in the floating-menu material (`panel`, `line` border, the floating-menu shadow) with 22 px corners, rising out of the queue round over the page (200 ms, from 10 px lower at 97 % scale, anchored toward the round; no motion under reduced motion). It takes the focus when it opens and gives it back to the queue round; Esc, Q, its × or a press outside it (the player bar and menus over it do not count) close it.
- **Header:** a 72 px cover (12 px corners) that plays or pauses, with a 26 px black-70 % badge in its corner showing a `glow-1` sound or pause icon; beside it the title in Manrope 800 at 15.5px in `glow-1`, the artist (a muted link) and a faint 12.5px source line: where the queue came from, how many tracks, «вперемешку» or «по порядку», and a `glow-1` 800 text link «перемешать» / «вернуть порядок». The endless selection says instead that it picks itself as you listen. A 32 px × round at the top right.
- **Tabs:** two filter pills (30 px, white 6 % muted, the chosen one white with ink, the count after the name in 12px figures at 60 %): «Дальше N» and the played-before tab, shown only when something is above the playing track. See The Honest Queue Rule for its name.
- **List:** windowed like every long list (fixed heights: 56 px rows, 34 px group names, eight rows of overscan), its top and bottom fading out over 8 and 24 px. «Дальше» is in groups named in faint 12.5px bold: «Ты добавил» (what was added with «Играть следующим»), then «Дальше из …» (the source's own name: «Дальше из лайков», «Дальше из «…»», «Дальше в подборке»). The played-before tab lists newest first, its art and text at 45 % until pointed at. A row added by hand that sits outside «Ты добавил» carries a «ты добавил» badge in `glow-1` text on `glow-1` at 15 %.
- **Row:** a 16 px grip column, the 44 px thumbnail (9 px corners), title in 14.5px 800 with the state badge and the artist link under it, the duration in faint figures and a 32 px × round. The whole row plays it; hover or focus tints it white at 5 %, shows the grip, the play veil on the thumbnail and the ×. The keyboard: arrows move between rows, Enter plays, Delete or Backspace takes out, Alt+↑/↓ moves the row.
- **Dragging:** the grip lifts a ghost of the row (`panel-hover`, 12 px corners, the dragged-row shadow) that follows the pointer while its place stays empty; the rows between slide over by one row in 160 ms on `cubic-bezier(0.2, 0.8, 0.2, 1)` to open the gap; near the list's edge (48 px) the list scrolls; Esc puts it back.
- **End note:** after the last row, in faint 12.5px, how the queue really ends: it stops, it starts again from the first track, the one track repeats, or the selection adds more.
- **Footer:** «Впереди N треков · время» in faint tabular figures, and at the right the quiet 32 px white-10 % pill «Очистить дальше» with its icon (white at 16 % on hover, 40 % when there is nothing ahead).
- **Empty:** «Очередь пуста» in 15px 800 with one muted line saying what to put on.

**The Honest Queue Rule.** The queue never claims more than happened. The played-before tab is «Уже играло» only when every track above the playing one really played; when some were only passed over (a jump forward, a list started from its middle) it is «Выше в списке». The end of the list says how the queue will really end, with the key that changes it.

### Key Help
A sheet that rises 24 px out of the player bar over 240 ms (no motion under reduced motion): full width, `panel` with a `line` border on all but its bottom edge, 22 px top corners and the upward sheet shadow, 22 px / 32 px padding. The player bar under it stays usable. It takes the focus itself, not its button, so space still plays, and gives it back on close (Esc, ?, its × or a press outside).
- **Keyboard:** a drawn keyboard of 34 px keys 4 px apart (wide keys in whole key widths), the arrows as a 34 × 25 px upside-down T at the end of the bottom row, the Mac or PC bottom row by platform, labels in Manrope 700 at 11.5px. A key that does something is white at 10 % with a `glow-1` underline; a key that does nothing is dimmed almost away; the pointed key, or every key of a pointed line, fills `glow-1` with ink text; a pressed key dips 1 px and shrinks to 96 %. Pointing at or pressing a key says what it does, and a press really does it.
- **Text column:** «Клавиши» in Section type with a 32 px × round; a white-5 % banner (14 px corners, at least 62 px tall, announced politely) with the keycaps and the action in 15.5px 800, or, at rest, an invitation to point or press; then every line of the map as a 30 px row, muted 13px with its keycaps at the right, white at 6 % with white text while it is the line spoken of; last a faint note that keys are quiet while typing and that the layout does not matter.

**The Quiet Keys Rule.** The window's single keys (space, arrows, digits, letters) stay silent while typing in a field, leave a focused control the keys it handles itself (a slider's arrows, a keyboard-focused button's space, a queue row's arrows), and never take Cmd or Ctrl shortcuts; the only ones the app uses are ⌘K / Ctrl+K and ⌘F / Ctrl+F, handled by the search and the filter. Held down, only seek and volume repeat. Esc closes the key help first, then the queue, and leaves an open menu its own Escape.

**The Physical Keys Rule.** Hotkeys are read by the key's place on the keyboard, not the letter it types, so Q, S, R and M work the same in the Russian layout; the help draws them in Latin.

### Keycap
A key name as a cap, used in the key help and in the account menu («Горячие клавиши ?»): veil, 7 px corners, a 1 px white-6 % bottom edge, Manrope 800 white, 26 px tall (12px text) or 22 px small (11px); arrows are drawn as icons, a range as «0 … 9», the modifier by platform (⌘ / ⌥ on a Mac, Ctrl / Alt elsewhere).

### Status Button
The one place for what went wrong: a 38 px pill in the top bar between the search field and the account, there only while something is wrong. White at 8 % (13 % on hover, 16 % while open), Manrope 800 at 13.5px, a 17 px icon or an 8 px dot before the words. It arrives over 250 ms from 92 % scale.
- **One problem:** its few words («Лайки не загрузились») after a `TriangleAlert` in `glow-1`. **Several:** «N проблем».
- **Offline:** «Нет сети» after a pulsing `fg-faint` dot. **Back:** «Сеть вернулась» after a `glow-1` dot, for 3.5 s, then the button goes.
- **Expired sign-in:** the button turns white with ink text, «Войти снова» with its icon, and opens the «Вход устарел» sheet instead of the panel.
- **Ping:** when an action fails the button plays the status ping (see Elevation & Depth).
- **«Что не так»:** a floating panel fixed under the bar at the right (62 px from the top, 22 px from the edge), 440 px wide, `panel`, `line` border, 22 px corners, the floating-menu shadow, 8 px padding, dropping in from 8 px higher over 200 ms; it scrolls inside itself and closes on Esc or a press outside. Its title in Section type with a 32 px × round. Each active problem is a card (16 px corners, 14 px / 16 px padding): the title in 15px 800, the plain-words text in muted 13.5px, then a row of 32 px white-10 % action pills («Повторить», «Перезапустить», «Войти снова», «Понятно»), a white-6 % countdown pill «Повторю сам через N с», the «Подробнее» disclosure (muted 800, its chevron turning over) and the time in faint tabular figures at the right. A card a part of the page asked for is tinted white at 4 % and opened. Problems that read the same are one card, and its «Повторить» asks for all of them.
- **Подробнее:** a white-4 % well (12 px corners) of name–value rows in 13px bold (faint names in a 124 px column): what SoundCloud answered, what was asked, when; the raw message in a mono well (white at 5 %, 10 px corners, 12px monospace, muted, at most 112 px tall); and «Скопировать для отчёта» (white-8 % pill, «Скопировано» with a check for 2 s).
- **Уже прошло:** solved problems below, named in faint 12.5px bold; their cards are shorter, the title muted 14px, no text, and the time says when it passed.
- **Nothing wrong:** opened from «Сеть вернулась», the panel says in muted text that everything works and where a problem would show.

**The One Place Rule.** Whatever goes wrong is told in one place: the status button and its «Что не так». A part of the page never carries its own error panel, banner or retry button; it keeps its shape and points to the one place. Reasons, actions and SoundCloud's answer live there, one click away.

**The Useful Retry Rule.** «Повторить» appears only when asking again can help: not while offline (the app asks by itself when the network returns), not while SoundCloud has said how long to wait (the countdown says when it will ask by itself), never for a part that broke (that is «Перезапустить»). The words agree with the part that failed («История не загрузилась», «Плейлисты не загрузились»).

### «Вход устарел» Sheet
An expired sign-in asks again from the same spot as «Что не так», in the same material (460 px, 22 px padding, 20 px at the bottom), as an alert dialog; the page stays visible behind it and nothing is cleared. The title in Unbounded 800 at 30px; the text in muted 14px; then a 46 px white pill «Войти снова» (scales 1.03 / 0.97; a spinner and «Жду вход в окне SoundCloud…» while it waits), and muted «Позже» and «Подробнее»; a short status line under them when the window closes early or fails. Last, a faint 13px «Вставить ключ вручную» with a key icon that opens the token field in a white-4 % well.

### Held Part
A part SoundCloud did not fill keeps its shape: its own skeleton at 45 % opacity, not interactive, with one smoke pill over its top-left corner (14 px in): 36 px, black at 86 % with the rim and a 12 px backdrop blur, bold 13.5px white, a 16 px `glow-1` icon. It reads «Не загрузилось · что случилось», «Догрузится, когда появится сеть», «Догрузится через N с», «Загрузится после входа · войти снова» or «Сломалось · что случилось»; the links are `glow-1` 800, underlined on hover, and open the problem's card in «Что не так» or the sign-in sheet. Under a list that loaded part way, the pill stands alone 12 px below the list («Загрузилось не всё», «Остальное догрузится…»).
- **Crash boundaries:** each page, each library view, each shelf, each home section and the player bar is its own part; one that throws shows its held frames and «Что не так» offers «Перезапустить», which mounts it afresh. The queue and the key help simply close and offer the same. If the window's frame itself breaks, a full-window «Сломалось» on ground (display type, a 17px lead, a 54 px white «Перезапустить окно» and the error in a mono well) is the last resort.

**The Kept Shape Rule.** A part that failed is never replaced by a message: it keeps its size and skeleton at 45 % so the page does not jump, and fills in where it stands when it comes back. One broken part never takes the page down.

### Diary Page
«Дневник» on the light: the word, one lead line («Что играло в Cloudify — по дням и частям суток…»), then a facts row. Its first fact is not a control: «Только на этом компьютере» in bold white at 80 % with a 17 px laptop icon and the lead's text shadow, standing on the light as a plain statement. Then the two setting chips (see Chips). Under them the sticky row: the filter well («Найти в дневнике», searching titles and artists, 200 ms after typing stops, opening every part in full while it finds) and the day strip.
- **Loading:** quiet `panel` shapes in the diary's rhythm (a day title bar, then a part with five row shapes), pulsing.
- **Nothing found:** the stage note «В дневнике нет «…». Ищется по названию трека и артисту.»
- **Failed:** the held part over the same shapes (see Held Part).

### Day Strip
The last weeks beside the find well, one bar per day by minutes heard (the most-heard day in view is 30 px, no day under 3 px), the day of the month under each in 10.5px bold figures: weekends `fg-muted`, weekdays faint. A heard day's bar is white at 26 % (50 % on hover); a day with nothing is white at 8 % and cannot be pressed. The day on screen is lit: its column becomes a smoke pill with the rim (8 px corners), its bar fills `glow-1` → `glow-2` from the top, its date turns white. Pressing a day brings it in page by page if it is not read yet and scrolls to it. Each day's title says its name and minutes, or «ничего не играло».

### Day Section
A header, then the day's parts, newest first (evening, day, morning, night). The header: the date in Section type («Сегодня», «Вчера», else the weekday; the date after it in `fg-muted`, with the year once it is not this one), its facts in 13px faint figures («3 ч 16 мин музыки · 89 треков», «меньше минуты» for a day just begun), and at the right, when the place is known, a 15 px sun with «8:12–16:36 · светло 8 ч 24 мин».

### Part Block
A part of a day as a `panel` block, 22 px corners, 6 px padding, 12 px apart.
- **Head (52 px):** a 36 px white round with an ink play icon (1.06 on hover, 0.95 on press) that plays the part again; the name in Manrope 800 at 15.5px («Ночь на 4-е»: a night belongs to the day it ends in; «Утро», «День», «Вечер»); its facts in 13px faint figures («00:22–03:41 · 89 треков · 3 ч 16 мин»); at the right the sky it mostly played under, a 15 px icon and 12.5px faint word («светло», «сумерки», «темно»), when the place is known.
- **Rows:** seven, then a 32 px white-10 % pill «Ещё N треков» with a chevron (white at 16 % on hover), set in under the rows' titles (66 px in), that opens the rest.

### Play Row
One play, in a 56 px grid with 12 px between parts, 12 px corners, 10 px side padding: the time it started (46 px, right-aligned, 12.5px faint figures), the 44 px cover (9 px corners), the title (14.5px 800, one line, its full name as a tooltip) with the artist under it (a muted 13px link that opens them), then, when the stage is wide enough (from 896 px), where it came from in 12.5px faint («из лайков», «подборка», «поиск «…»», «радио · …», «из дневника · …»), with « · ты добавил» in `glow-1` for a track added by hand; then how it ended; last a 32 px × round that shows on hover or focus. The whole row plays its part from here (the one sounding pauses); hover or focus tints it white at 4 % and lays the play veil (black at 45 %) on the cover. The row that is sounding has its title in `glow-1` and a black-55 % veil with a `glow-1` sound icon (pause on hover).
- **Ending:** a 44 px heard-bar (4 px, white at 12 %) filled to how far it got (never under 4 %), then the words. Played to the end: «дослушал» in white with a `glow-1` → `glow-2` fill, a 13 px repeat icon when it was started again. Left early: «пропустил на 0:12», ««не то» на 0:05», «остановил на 2:30» in `fg-muted` with a white-42 % fill, and the cover and the title column at 62 % until pointed at. Sounding now: «играет · 0:31» or «на паузе · 0:31» in `glow-1` with the glow fill, read from the player four times a second. A heart filled `glow-1` follows when it was liked while it played.
- **×:** takes the play out at once and says so in the player notice with «Вернуть»; nothing asks first.

### Diary Panels
«Сколько хранить» and «Где ты» drop 8 px under their chip (over it when there is no room), in the floating-menu material: 340 px, `panel`, `line` border, 16 px corners, 8 px padding, the floating-menu shadow, held between the top bar and the player bar and scrolling inside. The title in Unbounded 700 at 15px, a muted 13px line saying what it does, then 40 px options (12 px corners, bold muted; white at 6 % on hover or focus; the chosen one white at 10 % with a 17 px `glow-1` check). Arrows move between options; Escape, a press outside, a resize or a scroll close it and give the focus back to the chip.
- **Сколько хранить:** «30 дней», «180 дней», «Год», «Всегда»; a `line` rule; then «Стереть дневник» with the count in faint figures. Pressing it asks once, in place of that row: «Сотру N записей. Вернуть их будет нельзя.», a 34 px white pill «Стереть» (1.03 / 0.97, focused) and a 34 px white-10 % pill «Не надо».
- **Где ты:** a 38 px veil city field (19 px corners, white at 10 % on focus, focused on open; Enter takes the first match), «По часовому поясу» with the zone's city in faint, the matching cities, «Такого города нет в списке — выбери ближайший большой.» when none match, and a faint 12px note that the city counts for new plays only.

### Empty Diary
A `panel` card (22 px corners, 26 / 28 px padding, at most 640 px) on the ground under the row: «Пока здесь пусто» in 17px 800, a muted 14.5px paragraph saying what the diary will hold and that it stays on this computer, and the white primary pill «Включить подборку» 20 px under it.

**The Own Order Rule.** A part plays again as it was heard: oldest first, from the row pressed (or the first) onward, skipping only what can no longer play; the player names it («Из дневника · ночь на 4-е»), and what plays is written down again.

**The Honest Ending Rule.** A play says how it ended, in words and as a bar of how far it got. Only the play the player is on reads live; an open play the player is not on (the window closed or reloaded mid-song) reads as stopped where it stopped, which is how it will be written.

**The Said Where Rule.** The diary says where it is kept and what its light is reckoned from: «Только на этом компьютере» stands on the light, and a place guessed from the time zone says «· по часовому поясу» until a city is named.

## Do's and Don'ts

### Do:
- **Do** take every accent from `--glow-1`/`--glow-2`/`--glow-3`; let a cover change the whole window.
- **Do** keep the ground near-black (`#08080a`) and separate surfaces by tonal steps (ground, dock, panel, panel-hover).
- **Do** make the primary action a white pill with ink text, and give secondary actions on the light the smoky fill with a 1 px inner rim.
- **Do** set the one big word in Unbounded 800 scaled to its container, and everything else in Manrope at 600 or heavier.
- **Do** show real artwork wherever a track, playlist or person appears, with the quiet tile fallback.
- **Do** put grain over any surface that shows the light, and fade the light's edges.
- **Do** stop or slow every running animation when the window is hidden, off screen, paused or under reduced motion.
- **Do** say in the interface why something does not work (region, Go+ preview, offline, expired sign-in), on the row or tile and before play: unplayable covers are dimmed and disabled with the reason as their second line; Go+ previews carry their chip.
- **Do** let a page's own light take the colours of what is pointed at or opened, and give it back when the pointer leaves.
- **Do** window any list that can run into thousands, and keep the actions row in reach while it scrolls.
- **Do** lead a search with its answer: the artist it names, by the strict test of The Answer First Rule, else the query and its tracks; show found tracks as rows, so a long title can be read.
- **Do** offer only filter choices the results hold, with their counts.
- **Do** read hotkeys by physical key and keep them quiet while typing; name each control's key in its title.
- **Do** say what really happened and what will happen: «Уже играло» only for what played, and how the queue ends where it ends.
- **Do** gather everything that went wrong in the status button and «Что не так», and show the button only while something is wrong.
- **Do** keep a failed or broken part's shape as its skeleton at 45 % with one smoke pill, and grey the light while there is no network or sign-in.
- **Do** say how each play ended («дослушал», «пропустил на 0:12») with a bar of how far it got, and play a part again in its own order.

### Don't:
- **Don't** add a fixed brand accent, SoundCloud's orange as a UI colour, or Yandex Music's signature yellow; a mood turn must never produce yellow.
- **Don't** put borders around cards or tiles; `line` belongs only to the player bar's top edge, floating menus (and the rules inside them), the sheets over the player and the rule under a list's column heads.
- **Don't** put veil wells on the light; there they are smoke with a rim.
- **Don't** hide a track's name until hover; the caption under a cover is always there.
- **Don't** give flat panels drop shadows.
- **Don't** set track titles, buttons or sentences in Unbounded, or use Manrope below 600.
- **Don't** use stroked outline-only or square-cornered buttons; actions are filled pills and circles, or bare muted icons and text.
- **Don't** let colour transitions jump or the light run at full frame rate while idle.
- **Don't** add eyebrow labels or kickers above titles; a section is named by its title alone.
- **Don't** take a Cmd or Ctrl shortcut for a hotkey, or let a single-key hotkey fire while someone types.
- **Don't** put an error panel, banner or retry button in place of a part that failed, or offer «Повторить» where asking again cannot help.
