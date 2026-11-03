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
    padding: "0 16px"
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
  player-bar:
    backgroundColor: "{colors.dock}"
    height: "84px"
  player-play:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
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
- **Line** (`line`): the hairline on top of the player bar and around floating menus. Nowhere else.
- **Paper White** (`fg`): primary text and icons on hover.
- **Muted** (`fg-muted`): artist names, secondary lines, idle icons, nav tabs at rest.
- **Faint** (`fg-faint`): counts, durations, timestamps, the disclaimer. It is the lowest text tone allowed and is used only for short labels.
- **Ink** (`ink`): text and icons on white pills and the selected chip.
- **Smoke** (`smoke`, `smoke-hover`) with **Rim** (`rim`): the translucent dark fill and 1 px inner rim of secondary round buttons and mood chips that sit on the light.
- **Veil** (`veil`): white at 7 % for wells: the search field, the token input, state badges, the keyboard hint.

### Named Rules
**The Music Paints Rule.** No component gets a fixed accent colour. Anything that needs emphasis takes `glow-1`/`glow-2` (or white for actions); everything else stays on the neutral scale.

**The No Yellow Turn Rule.** Moods may rotate the cover's hues (`hueShift`), but a rotated hue that lands between 44° and 68° is pushed out to orange or lime. A cover's own yellow is the music's and stays; a yellow the app produces itself is never allowed.

**The Cross-Fade Rule.** Glow colours never jump. They are registered with `@property` and transition over 1.6 s on `:root`; reduced motion switches them instantly.

## Typography

**Display Font:** Unbounded Variable (with ui-sans-serif, system-ui)
**Body Font:** Manrope Variable (with ui-sans-serif, system-ui)

Both are self-hosted through fontsource, with Cyrillic, and ship inside the app.

**Character:** Unbounded's wide, rounded extra-bold makes one word fill the screen like a poster; Manrope at semibold and heavier keeps every small line sturdy and legible on near-black.

### Hierarchy
- **Display** (Unbounded 800, `min(132px, 15cqi)`, 0.92, −0.055em, single line): the one big word of a full screen: «Подборка», «Cloudify» on sign-in, the offline title. It scales with its container so it never wraps or clips in a 960 px window, and carries a soft dark text shadow to sit on the light.
- **Headline** (Unbounded 800, `clamp(64px, 8vw, 112px)`, 0.92, −0.055em): the title of a section page that is not built yet.
- **Section** (Unbounded 700, 19px, 1, −0.02em): section titles («Продолжить», «Лайки», «Плейлисты») and the wordmark beside the mark.
- **Lead** (Manrope 600, 17px, 1.45, max 42–52ch): the one line under a display word, in white at 80 % with a soft shadow when it sits on the light.
- **Title** (Manrope 800, 14–16.5px, about 1.25): track and playlist titles in rows, cards and the player; 19px bold under the hero cover.
- **Body** (Manrope 600, 14px, 1.4): the default for everything; nav tabs and secondary buttons go to 700 at 15px.
- **Label** (Manrope 700, 12.5–13.5px, tabular figures): counts, durations, times, timestamps, plan names, helper text.
- **Badge** (Manrope 800, 11px, 1): state badges on rows («Go+ · 30 с», «не в твоём регионе») and the keyboard hint.

### Named Rules
**The Place Name Rule.** Unbounded names places: the hero word, page titles, section titles and the wordmark. It never sets a track title, a button, a label or a sentence.

**The Heavy Body Rule.** Manrope never drops below 600. Hierarchy among small text comes from weight (600 / 700 / 800) and the three text tones, not from thin weights.

## Layout

A full-height window: the page scrolls under a floating 68 px top bar, and an 84 px player bar is pinned below the scroll area. The window is never narrower than 960 × 600 (1280 × 820 by default); on macOS the top bar starts at 94 px to clear the traffic lights, otherwise at 28 px.

- **Gutter:** 56 px on both sides of every page; 28 px inside the top bar and the player bar.
- **Hero:** a two-column grid, the text column flexible and the cover column `clamp(220px, 21vw, 300px)`, 48 px apart. The text starts at `clamp(88px, 13vh, 112px)` from the top, so it clears the top bar on short windows. Inside the text column the rhythm is 18 px (word to lead), 26 px (lead to actions), 22 px (actions to moods); actions are 12 px apart, chips 8 px.
- **Home grid:** three columns at 400 : 520 : 344 with 32 px gaps («Продолжить», «Лайки», «Плейлисты»). At 1179 px and narrower it becomes two columns with a 40 px row gap: resume and playlists on top, likes across the full width below.
- **Sections:** an 18 px gap from the section title to its content (12 px for track lists, whose rows carry their own padding). Track rows are 50 px tall.
- **Player bar:** three columns: now playing at `clamp(180px, 24vw, 320px)`, the transport with the waveform taking all remaining width, then secondary controls and a 92 px volume slider; column gaps `clamp(16px, 2.2vw, 30px)`.
- **Full-screen states** (sign-in, unreachable): the same light centred vertically, content capped at 1100 px, scrolling instead of clipping in a small window, the disclaimer pinned at the bottom.

## Elevation & Depth

Depth is tonal and luminous, not shadowed. Surfaces step up from ground (`ground` → `dock` → `panel` → `panel-hover`), and the only real "height" is the light: blurred ribbon bands blended with `screen`, covered by film grain at 45 % overlay so the gradients never band. The ribbon's box fades out at its top and bottom 16 %, and a 120 px gradient into ground closes the hero, so the light never shows an edge.

### Shadow Vocabulary
- **Floating menu** (`box-shadow: 0 18px 40px -16px rgb(0 0 0 / 0.8)`): popovers that float over content (the account menu, the search notice), together with a `line` border.
- **Hero cover** (`box-shadow: 0 30px 60px -24px rgb(0 0 0 / 0.8)`): the large cover in the hero, so it lifts off the light.
- **Inner rim** (`box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16)`): the edge of smoky buttons and chips on the light. It is an edge, not a lift.
- **Text on light** (`text-shadow: 0 10px 50px rgb(0 0 0 / 0.35)` on display, `0 2px 16px rgb(0 0 0 / 0.4)` on the lead): keeps type readable whatever colour the light takes.

### Named Rules
**The Tonal Step Rule.** Cards and tiles are flat panels; they never get a drop shadow. A shadow means the thing is floating over other content (a menu) or is the hero cover.

**The Grain Over Light Rule.** Any surface that shows the ribbon also carries the grain overlay.

**The Cheap Light Rule.** The ribbon redraws at about 30 fps while playing and 15 fps while paused, rewrites its SVG paths in place, stops when it is off screen or the window is hidden, and does not animate at all under reduced motion. Mood changes ease in over roughly half a second.

## Shapes

Everything is round. Interactive controls are full pills or circles; containers use large soft radii that shrink as they nest: hero cover 26 px, cards 22 px, tiles and section notices 18 px, popovers 16 px, artwork inside a card 14 px, inner controls and mosaics 12 px, list thumbnails 9 px, badges 8 px. Progress tracks and waveform bars are 4 px and 2 px rounded strips. Mosaics clip four covers into one rounded square. The mark is a single rounded stroke: one swell of a sound wave.

## Components

### Buttons
Confident and soft: big pills, quick spring on press.
- **Shape:** full pill or circle (9999px).
- **Primary:** white fill, ink text, Manrope 800 at 16px, 54 px tall with an icon on the left. One per region; it is the action the screen exists for («Слушать подборку», «Войти через SoundCloud»).
- **Hover / Active:** scales to 1.03 on hover and 0.97 on press over 150 ms; disabled drops to 50 % opacity and stops scaling.
- **Round secondary:** 54 px circle (or a 54 px pill with a label), smoke fill with the 1 px inner rim, white icon; hover deepens the smoke. Used beside the primary pill on the light.
- **Player play:** a 44 px white circle with ink icon; scales to 1.05 / 0.95.
- **Icon button:** 32 px circle, no fill, `fg-muted` icon that goes to `fg` on hover. Controls that do not work yet are disabled at 40 % with a title saying "скоро", never hidden behind fake behaviour.
- **Quiet text button:** «Все» and «Ещё раз»: muted bold text, or a 32 px white-10 % pill.
- **Focus:** a 2 px `glow-1` outline at 3 px offset everywhere.

### Chips
- **Style:** 36 px pills, smoke fill with the inner rim and a 6 px backdrop blur, Manrope 700, white at 90 %.
- **State:** the selected mood turns solid white with ink text and drops the rim. One is always selected.

### Cards / Containers
- **Corner Style:** 22 px for cards, 18 px for tiles.
- **Background:** `panel`, lifting to `panel-hover` on hover over 150 ms.
- **Shadow Strategy:** none (see The Tonal Step Rule).
- **Border:** none.
- **Internal Padding:** 16 px for cards, 10 px for playlist tiles.
- **Empty and failed states** use the same panel with muted 13.5px text that says exactly why; a retry button appears only when retrying can help.

### Inputs / Fields
- **Style:** veil fill (white at 7 %), no border; the search field is a 40 px pill-like well (20 px radius) with a search icon and a keyboard hint; the token field is 44 px with 12 px corners.
- **Focus:** the search well brightens to white at 10 %; other fields show the `glow-1` outline. The caret is `glow-1`.

### Navigation
- **Style:** three text tabs in the top bar, Manrope 700 at 15px, 38 px pills.
- **States:** muted at rest, white on hover; the current tab gets a white-10 % pill and white text.
- **Top bar:** transparent over the light, growing an 80 % ground backing with a strong backdrop blur once the page scrolls more than 8 px. The whole bar is a window drag region.

### Track Row
50 px rows: a 44 px thumbnail (9 px corners), title in Manrope 800 with the artist below in muted 13px, an optional state badge, and the full duration in faint tabular figures. Hover tints the row white at 5 %. The playing track's title turns `glow-1`. A track that cannot play is disabled with its art and text at 40 %, and its badge says why before anyone presses play.

### The Ribbon (signature)
Three stroked SVG bands (130, 70 and 26 px wide), blurred by 48 and 26 px, drawn in two gradients across `glow-2`, `glow-1` and `glow-3`, blended with `screen`. Their swell follows the playing track's loudness curve; moods set energy (height), pace (speed) and a hue turn. It sits behind the hero (440 px tall, from 40 px below the top) and behind the full-screen states, always with grain and faded edges.

### Waveform Seek
The player's progress bar is the playing track's real waveform: 4 px bars with 2 px gaps, 8–34 px tall, the played part filled with a `glow-1` → `glow-2` vertical gradient and the rest white at 18 %. It is a keyboard slider (arrows ±5 s, Page keys ±30 s). Without a waveform it draws a quiet even line.

## Do's and Don'ts

### Do:
- **Do** take every accent from `--glow-1`/`--glow-2`/`--glow-3`; let a cover change the whole window.
- **Do** keep the ground near-black (`#08080a`) and separate surfaces by tonal steps (ground, dock, panel, panel-hover).
- **Do** make the primary action a white pill with ink text, and give secondary actions on the light the smoky fill with a 1 px inner rim.
- **Do** set the one big word in Unbounded 800 scaled to its container, and everything else in Manrope at 600 or heavier.
- **Do** show real artwork wherever a track, playlist or person appears, with the quiet tile fallback.
- **Do** put grain over any surface that shows the light, and fade the light's edges.
- **Do** stop or slow every running animation when the window is hidden, off screen, paused or under reduced motion.
- **Do** say in the interface why something does not work (region, Go+ preview, offline, expired sign-in), on the row and before play.

### Don't:
- **Don't** add a fixed brand accent, SoundCloud's orange as a UI colour, or Yandex Music's signature yellow; a mood turn must never produce yellow.
- **Don't** put borders around cards or tiles; `line` belongs only to the player bar's top edge and floating menus.
- **Don't** give flat panels drop shadows.
- **Don't** set track titles, buttons or sentences in Unbounded, or use Manrope below 600.
- **Don't** use stroked outline-only or square-cornered buttons; actions are filled pills and circles, or bare muted icons and text.
- **Don't** let colour transitions jump or the light run at full frame rate while idle.
- **Don't** add eyebrow labels or kickers above titles; a section is named by its title alone.
