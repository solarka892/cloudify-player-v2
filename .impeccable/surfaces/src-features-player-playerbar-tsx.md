---
version: 1
slug: "src-features-player-playerbar-tsx"
primary_target: "src/features/player/PlayerBar.tsx"
related_targets: ["src/features/player","src/app/Shell.tsx"]
---

# Player — the bar, «Дальше» and the keys

Scope: the player bar's own extensions inside the signed-in shell: shuffle and repeat beside the transport, the queue sheet «Дальше» that rises out of the bar's queue button, the in-window hotkeys, and the keyboard help that opens on «?». Mode: Operate.

Audience and job: the author and listeners like them, music on for hours while doing something else. Asked 2026-11-04: they look at what comes next, jump to a track, take tracks out and reorder by dragging — all four. The key map was confirmed as proposed: space, ←/→ ±5 s, Shift+←/→ tracks, ↑/↓ volume, M, S, R, Q, ?.

Content: the live queue — what plays now (cover, title, artist), where the queue came from («из лайков», «из поиска «…»», «Подборка»), what the person added with «Играть следующим», the rest in play order (thousands for likes), what already played, and how the queue will really end (stop, start again, one track on repeat, the selection refilling). Go+ previews keep their badge; an empty queue and an empty «Дальше» say what happens next. The second tab is «Уже играло» when every track above the playing one really played, and «Выше в списке» when some were only passed over (a jump forward, or a list started from its middle) — the prototypes named it the same way, so a list never claims you heard what you skipped.

Constraints: 960×600 minimum window; a queue of 5 000 likes scrolls and drags lightly (windowed rows); keys are physical (they work in the Russian layout) and stay quiet while typing; nothing blinks while it runs for hours.

History: on 2026-11-04 the user compared three live prototypes on real SoundCloud tracks (`.impeccable/mocks/player/`): «Колонка» (a column beside the page, the dock turned upwards), «Над плеером» (a floating sheet out of the queue button) and «Страница» (the queue as a page on the light). They chose «Над плеером» for the queue, and «Клавиатура» (from «Страница») for the key help, over «Шпаргалка» and «Подсказки на кнопках».

## Direction contract

THESIS: The queue is the player's own pocket, not a page: it rises out of the bar's queue button over whatever you are looking at, shows what plays and where it came from, lets you jump, take out, clear and drag in place, then gets out of the way. Refuses the category default — a full-height sidebar that squeezes the page for good, or a modal list.

OWN-WORLD: The shell's world unchanged: near-black ground, colour only from the playing cover (glow-1 on the playing title, on active toggles and lit keys), the floating-menu material for the sheet (panel, line border, 22 px corners, floating shadow), 56 px queue rows with 44 px thumbnails at 9 px corners, filter-pill tabs, the quiet white-10 % pill for «Очистить дальше», veil keycaps, Manrope 600–800, Unbounded only for «Клавиши».

STORY: Press Q or the queue button: a sheet rises 12 px above the bar at the right — the playing cover at 72 px with title, artist and «Из лайков · 1 574 трека вперемешку · вернуть порядок»; tabs «Дальше 1 561» / «Уже играло 12»; «Ты добавил», then «Дальше из лайков» rows; grab a row's grip to move it, × takes it out (with «Вернуть»), «Очистить дальше» at the foot. Press ?: a keyboard is drawn above the bar, every key that does something lit in the cover's colour; point at one or press it and it says, and does, what it does.

FIRST VIEWPORT: Player bar 84 px: now playing | shuffle · back · play 44 · next · repeat (32 px rounds, glow-1 with a 4 px dot when on) and the waveform | heart, lyrics, queue (white on a white-10 % round while open), mute, volume. Sheet: 16 px from the right, 12 px above the bar, min(430 px, window − 32 px) wide, up to 660 px tall and never under the top bar. Key sheet: full width above the bar, 22 px top corners, a fifteen-unit keyboard of 34 px keys at the left, the actions at the right.

FORM: «Над плеером», chosen by the user over «Колонка» and «Страница» from live prototypes; the key help is «Клавиатура» from «Страница». No roll seed: an extension of the shell's established world. Signature interaction: dragging a row by its grip opens a gap the other rows slide around (160 ms); shuffle mixes everything not yet heard, and shuffle off returns the list's own order from the playing track.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
