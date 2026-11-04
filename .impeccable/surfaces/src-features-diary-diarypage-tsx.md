---
version: 1
slug: "src-features-diary-diarypage-tsx"
primary_target: "src/features/diary/DiaryPage.tsx"
related_targets: ["src/features/diary","src/app/Shell.tsx"]
---

# Дневник — every play, by days and parts of the day

Scope: the «Дневник» tab (`src/features/diary/DiaryPage.tsx`) and how the player writes into it. Mode: Operate.

Audience and job: the author and listeners like them. Asked 2026-11-04: they open the diary to find a half-forgotten track by when it played («что было в ночь на 14-е»), to see how they listen (what they finish, what they skip), and to play an evening again. How long it keeps: always by default (the user's choice), with 30 / 180 / 365 days / always set right on the screen.

Content: plays newest first, each with its hour, cover, title, artist, where it came from (the selection, likes, a playlist, search…, «ты добавил»), how far it got and how it ended (дослушал / пропустил на 0:12 / «не то» на 0:05 / дослушал и ещё раз / остановил на 2:30 / играет), and a heart when liked while it played. A day carries its light (sunrise to sunset, the length of the day); a part carries dark, dusk or light. The setting snapshot (part of day, weekday, season, daylight, the sun's height) is written for the future selection; the screen shows only what helps reading. Empty: what the diary will hold, and «Включить подборку».

Constraints: 960×600 minimum window; heavy days hold 100+ plays, so a part shows seven rows and opens the rest on request; everything is local and the screen says so; the sun is worked out for the time zone's city until a city is named, and the screen says so; erasing cannot be undone, so it asks once, in place.

History: on 2026-11-04 the user compared three live prototypes on real SoundCloud tracks with three weeks of made-up listening (`.impeccable/mocks/diary/`, served by the `diary-mocks` launch entry on :8770): «Итоги» (the day in hours first, the roll's lead), «Дни» and «Журнал» (a filterable table). They chose «Дни».

## Direction contract

THESIS: The diary is a diary: one page per day, each split into its night, morning, day and evening, newest first, every part playable again as it was. Refuses the category default: a flat «recently played» list, or a stats dashboard.

OWN-WORLD: The shell's world unchanged: near-black ground, the page light from the playing cover with grain, «Дневник» in Unbounded 800 like «Библиотека», smoke chips with a rim on the light (how long to keep, the place), the smoke filter well, parts as panel blocks with 22 px corners, 56 px play rows with 44 px thumbnails at 9 px corners, a 44 px heard-bar in glow-1→glow-2 for what played to the end and in white for what was left, Manrope 600–800, faint tabular times.

STORY: Open «Дневник»: the big word on the light, one lead line, «Только на этом компьютере», «Хранить всегда ▾», «Свет и темнота: Москва · по часовому поясу ▾». A sticky row: «Найти в дневнике» and a strip of the last three weeks, one bar per day by minutes heard, the day on screen lit. Then «Сегодня, 4 ноября · 3 ч 16 мин музыки · 89 треков», its light at the right; under it «Ночь на 4-е 00:22–03:41 · 89 треков» with a white round that plays it all again; rows say «дослушал», «пропустил на 0:12».

FIRST VIEWPORT: Top bar 68 px. «Дневник» from y ≈ 104, up to 108 px. The lead 17 px, 18 px under it. The chips 22 px under that. The sticky row 26 px lower: the 340 px find well at the left, the day strip filling the rest (26 px columns, bars up to 30 px, the date under each). The first day 36 px lower: the date in Section type, its facts as a label, its light at the right; part panels with 52 px heads.

FORM: «Дни», #1 of the seven on the ranked list, dealt by surface seed 8bc58349 and chosen by the user from live prototypes over «Итоги» (the roll's lead) and «Журнал». Signature interaction: a part's round plays that night or evening again in its own order, and a row plays from itself onward; what plays is written at the top as it plays and ends the way it ends.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
