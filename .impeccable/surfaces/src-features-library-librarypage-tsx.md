---
version: 1
slug: "src-features-library-librarypage-tsx"
primary_target: "src/features/library/LibraryPage.tsx"
related_targets: ["src/features/library","src/app/Shell.tsx"]
---

# Library — «Библиотека»

Scope: the Library tab of the signed-in shell: one big word on the light, the library's actions and section chips, then the music as a wall of its covers; a playlist, album or followed artist opens in place with its own name on its own light. Mode: Operate.

Audience and job: the author and listeners like them, 1 000+ likes, dozens of playlists. Most frequent tasks (asked 2026-11-03): play the likes, find one track among them, open a playlist. Their pain with soundcloud.com: shuffle only ever plays the last 10–20 loaded likes, so «Перемешать» here always covers the whole list.

Content: real SoundCloud data — all likes (paged to the end), own and liked playlists, own and liked albums, reposts, followings, radio from the artists most present in the likes, play history. Honest states on covers (Go+ preview chip, region-blocked covers dimmed and disabled with the reason in their name). Clicking a playlist opens it (user's answer); playing is the white round on its tile.

Chip counts: Лайки, Плейлисты, Альбомы, Репосты and Подписки count their lists as they arrive. Станции and История have none on purpose: the stations are made by the app from the likes, and the history is a rolling window of the last thousand plays.

Constraints: 960×600 minimum window; walls of 1 000–5 000 covers scroll and filter instantly (only the rows near the screen exist); the light idles cheaply and stops off screen.

History: the first build was «Колонка и сцена» (rail + stage); on the real account the user found it heavy and asked to see the decision page's structures as live HTML. Seeing all three, they chose «Стена обложек» on 2026-11-03.

## Direction contract

THESIS: The library is the wall of your own covers, big and named like soundcloud.com's grid, and the light at the top takes the colours of whichever cover you point at. Refuses the category default — a text list of rows where the music is a 40 px thumbnail.

OWN-WORLD: The home screen's world unchanged: near-black ground, colour only from covers (the pointed cover, else the opened playlist's, else the playing one), white pill primary, smoky rounds and mood-chip material for sections, Unbounded ExtraBold for «Библиотека» and opened names, Manrope 600–800 for everything else, 12 px-cornered covers with their title and artist under them, 18 px panel tiles for playlists, grain over the light.

STORY: Open Библиотека: the big word on the light, «Перемешать все 1 574» that really means all, «Найти у себя», chips for the sections; then one row of every section (likes, playlists, albums, reposts, followings, stations, history), each title opening the whole section as a wall of covers or tiles (the user's ask, 2026-11-03). Point at a cover: the light becomes it, a white play round and the heart and «…» rounds appear; type and everything that matches appears.

FIRST VIEWPORT: Top bar 68 px. From x 56, y ≈ 104: «Библиотека» in Unbounded 800 up to 108 px over the ribbon light (480 px, full width). Below: white «Перемешать все N» pill (54 px), the smoky filter well «Найти у себя» (340 px) beside it, a jump round at the far right; this row sticks under the top bar. Chips row (36 px). Shelves, each one row that fits the window and never scrolls sideways: «Лайки N ›» track tiles from 168 px, «Плейлисты N ›» and «Альбомы N ›» tiles from 168 px, 18 px apart, then reposts, followings, stations, history. A full section is a wall of track tiles from 196 px (six across 1440), 24 px apart in a row and 28 px between rows, title and artist always under each cover. Player 84 px below.

FORM: «Стена обложек», #7 on the ranked list of seven, the roll's lead from surface seed 82cab7e8; first passed over for «Колонка и сцена», then chosen by the user from live prototypes. Signature interaction: pointing at a cover relights the page in its hues (0.6 s) and shows its actions (play, like, play next, radio, artist, link); leaving returns the light to the opened or playing cover (1.6 s).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
