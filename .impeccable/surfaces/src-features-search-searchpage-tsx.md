---
version: 1
slug: "src-features-search-searchpage-tsx"
primary_target: "src/features/search/SearchPage.tsx"
related_targets: ["src/features/search","src/app/TopBar.tsx","src/app/Shell.tsx","src/features/library/PageLight.tsx","src/features/library/Stage.tsx"]
---

# Search — «Поиск»

Scope: the search of the signed-in shell: the top bar's field with its suggestions list, and the search page it opens in place of the current tab: the answer first on the light (a found artist, or the query itself), the kinds as chips, «Всё» as the ten best tracks in two columns of rows plus one shelf each of albums, playlists and people, and each kind in full, with tracks as a windowed list beside a column of filters. An artist or playlist opened from the results takes the page's place, and «Поиск» brings the results back where they were left. Mode: Operate.

Audience and job: the author and listeners like them, looking up an artist, a track heard somewhere, or a mood like «deep house». The job: get to the thing meant in one step, and read through many found tracks (often re-uploads with long, messy names) to pick the right one.

Content: real SoundCloud search data: completions while typing, the top hits at once, tracks, people, playlists and albums with SoundCloud's estimated totals, and the genres SoundCloud counts among this search's tracks (`facet=genre`), counted with the other filters but not the genre. Results page by offset, 40 tracks and 30 tiles at a time, paged in ~1 200 px before the end. Honest states on rows (Go+ preview and region badges; a track that cannot play is dimmed and disabled). The last eight searches stay on this computer and are offered in the empty field.

Best match: an artist is the hero only when SoundCloud ranks a same-named account (username or full name) in its first three people and it is verified or has 5 000+ followers: «pyrokinesis» gets pyrokinesis, «deep house» gets nobody. While typing, from three letters, a name that starts with what is typed will do («pyro» → pyrokinesis).

Constraints: 960×600 minimum window; the full track list is windowed (56 px rows), so two thousand found tracks scroll like one screen; the filter column sticks under the top bar and the stuck chips and scrolls inside itself; the light idles cheaply and stops off screen.

History: on 2026-11-04 the user compared three live HTML prototypes built on real SoundCloud results for «pyrokinesis», «molchat doma» and «deep house»: «Полки» (library-like shelves of each kind), «Главное сверху» (best match first, tracks as rows, filters as a left column) and «Одна стена» (the field itself is the giant word, one mixed wall in SoundCloud's order). They picked «Главное сверху». Tracks are rows here, unlike the library's wall of covers, because a found title is read before it is played, and re-uploads come with long names that a caption under a cover cuts short.

## Direction contract

THESIS: Search answers first. When the query names an artist, the page is that artist, big on their own light with their radio one press away; otherwise it is the query itself and its tracks. Found tracks are rows to read, not covers to point at. Refuses the category default: one undifferentiated mixed list where the artist you meant is a small row among namesakes.

OWN-WORLD: The library's world unchanged: near-black ground, colour only from covers (the pointed row's cover, else the opened item's face, else the best-match artist's face, else the playing cover), white pill primary, 54 px smoky rounds, section-chip material for the kinds, Unbounded ExtraBold for the fitted title, Manrope 600–800 for everything else, 12 px-cornered row highlights with 9 px thumbnails, a 22 px panel for the filter column, grain over the light.

STORY: Type in the top bar: SoundCloud's completions, then the artist and a couple of tracks at once, then «Искать «…»». Press Enter: the page becomes the answer, «pyrokinesis» on the light with «Артист · N подписчиков · N треков», «Радио артиста» and a round for the popular tracks; the big name and the face open the artist's page. Under it the kinds as chips with their counts; on «Всё» the ten best tracks as two columns of rows (heart and «…» on hover), then albums (the artist's own first), playlists and people. «Треки ›» opens every track as a wide list (genre, plays, date added) beside the filters, paged in as you scroll.

FIRST VIEWPORT: Top bar 68 px with the 340 px search field. From x 56, y ≈ 104: the fitted title (the artist's name or the query) in Unbounded 800 up to 112 px over the ribbon light (480 px, full width); one lead line 18 px below; the white pill and a 54 px round 26 px below that; a found artist's circular face (180–240 px, hero shadow) at the right. The kind chips (36 px) stick under the top bar. 20 px below them «Треки N ›» and five rows of 56 px in each of two columns 32 px apart, then the «Альбомы» shelf from 168 px tiles. Player 84 px below.

FORM: «Главное сверху», chosen by the user over «Полки» and «Одна стена» from live prototypes on real results. Signature interaction: the hero is earned by a strict match (top three, same name, verified or 5 000+ followers), and pointing at a found row relights the page in its cover's hues (0.6 s); leaving returns the light to the found artist or the playing cover (1.6 s).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
