---
version: 1
slug: "src-features-selection-selectiondesk-tsx"
primary_target: "src/features/selection/SelectionDesk.tsx"
related_targets: ["src/features/selection","src/features/player/PlayerBar.tsx","src/features/home/Hero.tsx"]
---

# Selection — «Пульт», «почему», «не то» / «больше такого»

Scope: the selection engine's interface inside the signed-in shell: the desk «Настроить подборку» that rises out of the player bar, the «почему» line under the playing title, «не то» and «больше такого» in the player bar while the selection plays, the honest learning badge, and the hero's round that opens the desk. Mode: Operate.

Audience and job: the author and listeners like them, music on for hours. They steer without stopping what they do (two presses in the bar, from any page), and now and then open the desk to set how much is new, what the selection is made from, and to see what it has learned.

Content: real data only. The «почему» line words facts the engine worked out (where the track came from, what you did with it): «Похож на «…» — ты дослушал его вчера». Sources: likes, history, radios and related tracks grown from what was heard out lately, last winter and this week a year ago from the diary; empty ones say why and when they will fill. «Что подборка знает о тебе»: counts from the diary (artists heard out, artists left in seconds, «не то»). An empty diary says «Правила по умолчанию» and that nothing is learned yet.

Constraints: 960×600 minimum; one sheet over the player at a time (desk, queue, key help); keyboard reachable (slider arrows, Esc); reduced motion; nothing blinks while it plays for hours.

History: on 2026-11-04 the user compared three live prototypes running the real engine on real SoundCloud tracks (`.impeccable/mocks/podborka/`): «Свет» (everything on the home light), «Плеер» (presses around the transport, «Дальше» as the control room) and «Пульт» (a full-width desk out of the player bar). They chose «Пульт». The five mood chips stay as they are until the mood sliders of stage 4; «Любимое» and «Незнакомое» pin the balance slider to its ends.

## Direction contract

THESIS: The selection explains itself in one line and is set in one place: a desk that rises out of the player like the key help, where the balance, the sources and what was learned are seen together and the next twelve covers rearrange as you drag. Refuses the category default — a settings page of toggles far from the music, or a black box with no reasons.

OWN-WORLD: The shell's world unchanged: near-black ground, colour only from the playing cover (glow-1 on the slider's fill, the lit tags of new tracks, the switches that are on), the key help's sheet material (panel, line border on all but the bottom, 22 px top corners, upward sheet shadow), Manrope 600–800, Unbounded only for the desk's title, 12 px covers in the strip, quiet white-6 % wells.

STORY: Play the selection: under the title the bar says why this track («Из твоих лайков · дослушал 5 из 6»). «Не то» or «больше такого» beside the heart change what comes next at once, with «Вернуть». Press the sliders round (on the light or in the bar): the desk rises — drag «Знакомое ↔ Новое» and watch the next twelve covers change; switch a source off or make it come more often; read what the diary taught.

FIRST VIEWPORT: Desk full width above the 84 px bar, up to the top bar's line: a header row («Настроить подборку», the learning badge, ×), then three columns at 1.15 : 1 : 0.85 with 32 px gaps — the slider, its sentence and a 6 × 2 strip of covers with source tags; the six source rows with switch and «реже / как обычно / чаще»; «Что подборка знает о тебе». The bar keeps «не то» and «больше такого» before the heart, then the sliders round.

FORM: «Пульт», chosen by the user over «Свет» and «Плеер» from live prototypes. No roll seed: an extension of the shell's established world. Signature interaction: dragging the balance re-picks the queue live and the strip of next covers rearranges under the hand; a press in the bar re-picks what follows and «Вернуть» puts it back.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
