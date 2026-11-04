import { create } from "zustand";
import { relatedTracks, trackStation } from "@/api/player";
import type { Track } from "@/api/types";
import { queryClient } from "@/app/queryClient";
import { noteMore, takeBackRejected } from "@/features/diary/record";
import { type QueueOptions, usePlayer } from "@/features/player/store";
import {
  NOVELTY_STEPS,
  type Pick,
  type Pool,
  type Selection,
  type SelectionInput,
  type Steer,
  select,
  tracksOf,
} from "@/features/selection/engine";
import type { MoodId } from "@/features/selection/moods";
import { nextSeed } from "@/features/selection/random";
import { useSelectionSettings } from "@/features/selection/settings";
import {
  EARLY_SKIP_SECONDS,
  forgetSkip,
  rememberSkip,
  skippedTracks,
} from "@/features/selection/skipped";

// «Подборка» while it plays: the mood, the order's seed, what was pressed this
// session («больше такого», «не то», early skips) and why each queued track was
// picked. Presses change what comes next at once: the part of the queue after
// the playing track is picked again, and «Вернуть» takes a press back.

/** Everything the engine reads that comes from the library and the diary, not from this session. */
export interface BaseInput {
  likes: SelectionInput["likes"];
  history: SelectionInput["history"];
  pools: SelectionInput["pools"];
  taste: SelectionInput["taste"];
}

/** How long a SoundCloud list stays fresh for the selection. */
export const LIST_STALE_MS = 30 * 60_000;

interface SessionState {
  mood: MoodId;
  /** One order per run; a refill moves it on. */
  seed: number;
  steers: readonly Steer[];
  /** Radios and related lists fetched for «больше такого», by the track it was pressed on. */
  extra: ReadonlyMap<number, readonly Pool[]>;
  /** Why each track of the queue the player holds was picked: the «почему» line reads it. */
  picks: ReadonlyMap<number, Pick>;
  /** The last build's places, so a rebuild moves only what a press changed. */
  places: ReadonlyMap<number, number> | null;
  /** Bumped when a skip is remembered, so the preview leaves that track out. */
  skips: number;
  /** The library and the diary as the shell last read them. */
  base: BaseInput | null;
}

export const useSelectionSession = create<SessionState>()(() => ({
  mood: "usual",
  seed: Math.floor(Math.random() * 2 ** 31),
  steers: [],
  extra: new Map(),
  picks: new Map(),
  places: null,
  skips: 0,
  base: null,
}));

/** The shell's latest reading of the library and the diary. */
export function provide(base: BaseInput) {
  useSelectionSession.setState({ base });
}

const playingSelection = () => {
  const player = usePlayer.getState();
  return player.source?.kind === "selection" && player.index >= 0;
};

/** The pools the session added for «больше такого», before the library's own. */
function morePools(extra: ReadonlyMap<number, readonly Pool[]>): Pool[] {
  return [...extra.values()].flat();
}

/** Builds a queue from the latest library and diary and this session's presses. */
export function build(patch: {
  seed?: number;
  exclude?: ReadonlySet<number>;
  places?: ReadonlyMap<number, number> | null;
  before?: readonly Track[];
}): Selection | null {
  const s = useSelectionSession.getState();
  if (!s.base) return null;
  return select({
    ...s.base,
    pools: [...morePools(s.extra), ...s.base.pools],
    mood: s.mood,
    seed: patch.seed ?? s.seed,
    skipped: skippedTracks(),
    steers: s.steers,
    settings: useSelectionSettings.getState().settings,
    exclude: patch.exclude,
    places: patch.places ?? undefined,
    before: patch.before,
    now: Date.now(),
  });
}

/** Keeps why each track was picked, for the queue the player now holds. */
function remember(selection: Selection, fresh: boolean) {
  useSelectionSession.setState((s) => {
    const picks = new Map(fresh ? [] : s.picks);
    for (const pick of selection.picks) picks.set(pick.track.id, pick);
    return { picks, places: selection.places };
  });
}

/** The queue after the playing track is picked again: a press, a mood or a setting changed. */
export function rebuild() {
  if (!playingSelection()) return;
  const player = usePlayer.getState();
  const { queue, index } = player;
  // What played, what plays and what the person added stay; the rest is picked again.
  const kept = queue.filter((entry, i) => i <= index || (i > index && entry.added));
  const selection = build({
    exclude: new Set(kept.map((entry) => entry.track.id)),
    places: useSelectionSession.getState().places,
    // What plays now and what the person added come first: the new part starts after them.
    before: kept.map((entry) => entry.track),
  });
  if (!selection) return;
  player.replaceUpcoming(tracksOf(selection));
  remember(selection, false);
}

/** The player's side of the endless queue: more tracks when it runs low, and what skips teach. */
function options(): QueueOptions {
  return {
    refill: (exclude) => {
      const seed = nextSeed(useSelectionSession.getState().seed);
      useSelectionSession.setState({ seed });
      const before = usePlayer.getState().queue.map((entry) => entry.track);
      let selection = build({ seed, exclude, before });
      // Everything has had a turn: start the round again rather than stop.
      if (selection && selection.picks.length === 0) selection = build({ seed, before });
      if (!selection) return [];
      remember(selection, false);
      return tracksOf(selection);
    },
    onSkip: (track, reason, position) => {
      if (reason === "dislike") {
        steer({ kind: "less", track, from: fromOf(track), at: Date.now() });
        rememberSkip(track.id);
        useSelectionSession.setState((s) => ({ skips: s.skips + 1 }));
        usePlayer.getState().say(`«${track.title}» — больше не предложу, и похожего меньше`, {
          label: "Вернуть",
          run: () => takeBackNotThis(track),
        });
      } else if (reason === "skip" && position < EARLY_SKIP_SECONDS) {
        steer({ kind: "skip", track, from: fromOf(track), at: Date.now() });
        rememberSkip(track.id);
        useSelectionSession.setState((s) => ({ skips: s.skips + 1 }));
      } else {
        return;
      }
      // The player moves on after telling: what comes next is picked again once it has.
      queueMicrotask(rebuild);
    },
  };
}

/** The track a queued track's radio or related list grew from, if it came from one. */
function fromOf(track: Track): number | null {
  return useSelectionSession.getState().picks.get(track.id)?.seed?.track.id ?? null;
}

function steer(press: Steer) {
  useSelectionSession.setState((s) => ({ steers: [...s.steers, press] }));
}

/** Plays the selection from its `index`-th track. */
export function start(selection: Selection, index = 0) {
  const tracks = tracksOf(selection);
  if (tracks.length === 0) return;
  usePlayer.getState().playQueue(tracks, index, { kind: "selection" }, options());
  remember(selection, true);
}

/** A new mood: a playing selection keeps its track and changes what follows. */
export function chooseMood(mood: MoodId) {
  useSelectionSession.setState({ mood });
  rebuild();
}

/**
 * «Больше такого» on the playing track: its artist and tracks like it come
 * sooner, from now on, and the diary remembers it.
 */
export function moreLikeThis() {
  if (!playingSelection()) return;
  const player = usePlayer.getState();
  const track = player.queue[player.index]?.track;
  if (!track) return;
  const s = useSelectionSession.getState();
  if (s.steers.some((press) => press.kind === "more" && press.track.id === track.id)) {
    player.say(`Уже ищу больше такого, как «${track.title}»`);
    return;
  }
  steer({ kind: "more", track, from: fromOf(track), at: Date.now() });
  noteMore(track.id, true);
  rebuild();
  player.say(`Дальше — больше похожего на «${track.title}»`, {
    label: "Вернуть",
    run: () => takeBackMore(track),
  });
  // Its own radio and related tracks join as soon as SoundCloud answers.
  void fetchMore(track).then((pools) => {
    const now = useSelectionSession.getState();
    if (!now.steers.some((press) => press.kind === "more" && press.track.id === track.id)) return;
    useSelectionSession.setState({ extra: new Map(now.extra).set(track.id, pools) });
    rebuild();
  });
}

/** «Не то» on the playing track: skipped, never offered again, and less of what is like it. */
export function notThis() {
  if (!playingSelection()) return;
  usePlayer.getState().next("dislike");
}

async function fetchMore(track: Track): Promise<Pool[]> {
  const seed = { track, reason: "more" as const, at: Date.now() };
  const [station, related] = await Promise.allSettled([
    queryClient.fetchQuery({
      queryKey: ["station", track.id],
      queryFn: () => trackStation(track.id),
      staleTime: LIST_STALE_MS,
    }),
    queryClient.fetchQuery({
      queryKey: ["related", track.id],
      queryFn: () => relatedTracks(track.id),
      staleTime: LIST_STALE_MS,
    }),
  ]);
  // Whatever did not come is simply missing: the artist's lean still works.
  const pools: Pool[] = [];
  if (station.status === "fulfilled")
    pools.push({ source: "stations", seed, tracks: station.value });
  if (related.status === "fulfilled")
    pools.push({ source: "related", seed, tracks: related.value });
  return pools;
}

function takeBackMore(track: Track) {
  useSelectionSession.setState((s) => {
    const extra = new Map(s.extra);
    extra.delete(track.id);
    return {
      steers: s.steers.filter((press) => !(press.kind === "more" && press.track.id === track.id)),
      extra,
    };
  });
  noteMore(track.id, false);
  rebuild();
}

function takeBackNotThis(track: Track) {
  useSelectionSession.setState((s) => ({
    steers: s.steers.filter((press) => !(press.kind === "less" && press.track.id === track.id)),
    skips: s.skips + 1,
  }));
  forgetSkip(track.id);
  takeBackRejected(track.id);
  rebuild();
}

/** A press taken back from the desk, as its «Вернуть» would. */
export function takeBack(press: Steer) {
  if (press.kind === "more") takeBackMore(press.track);
  else if (press.kind === "less") takeBackNotThis(press.track);
}

/** How much is new, as the balance shows it: «Любимое» and «Незнакомое» pin it to its ends. */
export function balanceOf(mood: MoodId, novelty: number): number {
  if (mood === "fav") return 0;
  if (mood === "new") return NOVELTY_STEPS;
  return novelty;
}

/** The balance moved: a pinned mood lets go of it, and what follows follows the new balance. */
export function setBalance(novelty: number) {
  const pinned = ["fav", "new"].includes(useSelectionSession.getState().mood);
  if (pinned) useSelectionSession.setState({ mood: "usual" });
  const settings = useSelectionSettings.getState();
  const before = settings.settings;
  settings.setNovelty(novelty);
  // The same number as before: no setting changed, but the mood did.
  if (pinned && useSelectionSettings.getState().settings === before) rebuild();
}

/** A setting changed while the selection plays: what follows follows it at once. */
useSelectionSettings.subscribe((now, before) => {
  if (now.settings !== before.settings) rebuild();
});
