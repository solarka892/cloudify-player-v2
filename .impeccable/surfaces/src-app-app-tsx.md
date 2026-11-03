---
version: 1
slug: "src-app-app-tsx"
primary_target: "src/app/App.tsx"
related_targets: ["src/features/home","src/features/player","src/features/session"]
---

# Home — «Подборка»

Scope: the signed-in home screen with its shell (top bar, player bar), and the sign-in screen in front of it. Mode: Operate — a player the user is inside of for hours: start their own music within a second, steer it, let it run.

Audience and job: the author and listeners like them, with 1 000+ likes and many playlists. Action: press «Слушать подборку», a like or a playlist; steer with moods, skip, «не то».

Content: real SoundCloud data after sign-in — likes, own playlists, play history, the selection built from them, the playing track's waveform. Honest states on every row and in the player: Go+ preview, region block, unplayable stream, offline, expired sign-in.

Constraints: Tauri window, 960×600 minimum, 1280×820 default; macOS traffic lights sit inside the top bar; fonts bundled; the light animates for hours, so it idles cheaply and stops when hidden.

## Direction contract

THESIS: The selection is a living light, not a tile: a ribbon of colour pulled from the playing cover, swelling with the track's own waveform, behind one huge word. Refuses the category default — shelves of same-size covers with a small "made for you" card.

OWN-WORLD: Near-black ground #08080a; colour comes only from the music (three cover hues, 1.6 s cross-fades); white pill primary actions, smoky round secondaries with a 1 px inner rim; Unbounded ExtraBold for the big word and section titles, Manrope for everything else; 18–26 px rounded panels #121215; real artwork everywhere; fine grain over the light.

STORY: Open the app and your music is one press away. «Подборка», one line saying where it comes from, «Слушать подборку», five moods that visibly change the light; on the right, the cover that plays. Below: where you stopped, your latest likes with honest badges, your playlists as mosaics; the player shows the real waveform.

FIRST VIEWPORT: 68 px top bar over the light (mark + Cloudify, Главная/Библиотека/Дневник, search ⌘K, avatar). Left column from x 56, y ≈ 112: «Подборка» at 132 px (scales down to fit narrow windows), 17 px lead line, 54 px white «Слушать подборку» pill + skip + «не то» rounds, 36 px mood chips. Right: the current cover at 300 px with title and artist. Ribbon full width from y 40 to 480, fading into the ground. Sections from y ≈ 500: Продолжить · Лайки · Плейлисты at 400 : 520 : 344. Player 84 px at the bottom. The white pill is the primary action.

FORM: user-pinned — the ribbon comp (`.impeccable/mocks/decision/ribbon.html`, the user's pick on 2026-11-03 from the Yandex-Music-like round), title renamed «Волна» → «Подборка». No roll seed: the direction was pinned by the user (PRODUCT.md brand commitment). Signature interaction: moods reshape the light (amplitude, pace, hue) and the queue; the light breathes with the playing track's waveform and slows to a drift when paused.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
