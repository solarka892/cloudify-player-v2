import {
  CalendarClock,
  CalendarHeart,
  Disc3,
  Heart,
  type LucideIcon,
  Radio,
  Snowflake,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import type { Track } from "@/api/types";
import { usePanels } from "@/features/player/panels";
import { usePlayer } from "@/features/player/store";
import { type ArtistFact, sayMix, sourceRows, whatItKnows } from "@/features/selection/desk";
import { LEARNING_PLAYS, type Pick, SIDE, type SourceId } from "@/features/selection/engine";
import { LearnBadge } from "@/features/selection/LearnBadge";
import { MixSlider } from "@/features/selection/MixSlider";
import { balanceOf, setBalance, takeBack, useSelectionSession } from "@/features/selection/session";
import { useSelectionSettings, WEIGHTS } from "@/features/selection/settings";
import { useSelection } from "@/features/selection/useSelection";
import { whyParts } from "@/features/selection/why";
import { Artwork } from "@/ui/Artwork";
import { formatCount, plural } from "@/ui/format";

// «Настроить подборку»: the selection's desk rises out of the player bar across
// the window, like the key help. The balance with the next twelve covers that
// rearrange as you drag, every source with its switch and weight, and what the
// diary has taught — counts the engine itself uses, nothing made up.

const SOURCE_ICON: Readonly<Record<SourceId, LucideIcon>> = {
  likes: Heart,
  history: CalendarClock,
  winter: Snowflake,
  yearAgo: CalendarHeart,
  stations: Radio,
  related: Disc3,
};
const WEIGHT_WORDS: Readonly<Record<number, string>> = { 0.5: "реже", 1: "как обычно", 2: "чаще" };
/** Covers in the strip of what comes next. */
const STRIP = 12;

export function SelectionDesk() {
  // The key help covers the bar's width: the desk steps aside meanwhile and comes back after.
  const open = usePanels((s) => s.desk && !s.keys);
  return open ? <Desk /> : null;
}

function Desk() {
  const box = useRef<HTMLElement>(null);
  const selection = useSelection();
  const close = () => usePanels.getState().showDesk(false);

  // Outside presses close it; the player bar and the buttons that open it do not count.
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || box.current?.contains(target)) return;
      if (target.closest("[data-player-bar], [data-desk-toggle]")) return;
      usePanels.getState().showDesk(false);
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, []);

  // The sheet takes the focus — so space still plays — and gives it back when it closes.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = box.current;
    node?.focus({ preventScroll: true });
    return () => {
      const here = document.activeElement;
      if (here === document.body || (node && here && node.contains(here))) {
        before?.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <section
      ref={box}
      id="selection-desk"
      role="dialog"
      aria-labelledby="desk-title"
      tabIndex={-1}
      className="sheet-up fixed inset-x-0 bottom-[84px] z-[45] max-h-[calc(100vh-84px-76px)] overflow-y-auto overscroll-contain rounded-t-[22px] border border-line border-b-0 bg-panel px-8 pt-[22px] pb-[26px] shadow-[0_-24px_60px_-20px_rgb(0_0_0/0.8)] outline-none"
    >
      <header className="flex items-center gap-3.5">
        <h2
          id="desk-title"
          className="font-bold font-display text-[19px] leading-none tracking-[-0.02em]"
        >
          Настроить подборку
        </h2>
        <LearnBadge learning={selection.learning} plays={selection.plays} />
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          title="Закрыть (Esc)"
          className="ml-auto grid size-8 place-content-center rounded-full text-fg-muted transition-colors hover:bg-white/[0.08] hover:text-fg"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>
      <div className="mt-[18px] grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-8 max-[1179px]:grid-cols-2">
        <Balance picksOfPreview={selection.picks} />
        <Sources />
        <Known />
      </div>
    </section>
  );
}

const columnName = "mb-3 font-extrabold text-[13px] text-fg-faint";

/** The balance, its sentence, the next twelve covers and this session's presses. */
function Balance({ picksOfPreview }: { picksOfPreview: readonly Pick[] }) {
  const mood = useSelectionSession((s) => s.mood);
  const novelty = useSelectionSettings((s) => s.settings.novelty);
  const steers = useSelectionSession((s) => s.steers);
  const picks = useSelectionSession((s) => s.picks);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.source?.kind === "selection" && s.index >= 0);
  const balance = balanceOf(mood, novelty);
  const said = sayMix(balance);
  const now = Date.now();

  // What comes next: the queue the player holds while the selection plays, else what would play.
  const next = useMemo((): { track: Track; pick: Pick | null }[] => {
    if (playing) {
      return queue
        .slice(index + 1, index + 1 + STRIP)
        .map((entry) => ({ track: entry.track, pick: picks.get(entry.track.id) ?? null }));
    }
    return picksOfPreview.slice(0, STRIP).map((pick) => ({ track: pick.track, pick }));
  }, [playing, queue, index, picks, picksOfPreview]);
  const presses = steers.filter((s) => s.kind !== "skip");

  return (
    <div className="max-[1179px]:col-span-2">
      <h3 className={columnName}>Знакомое и новое</h3>
      <MixSlider value={balance} label={said} onChange={setBalance} />
      <p className="mt-2 font-bold text-[14px] text-fg">{said}</p>
      <ul
        className="mt-[18px] grid grid-cols-6 gap-2.5 max-[1179px]:grid-cols-12"
        aria-label="Дальше в подборке"
      >
        {next.map(({ track, pick }) => {
          const fresh = pick !== null && SIDE[pick.source] === "new";
          const Tag = pick ? (fresh ? Sparkles : SOURCE_ICON[pick.source]) : Sparkles;
          const why = pick ? whyParts(pick.facts, now) : [];
          return (
            <li key={track.id} className="min-w-0" title={[track.title, ...why].join(" · ")}>
              <span className="relative block">
                <Artwork
                  url={track.artworkUrl}
                  size={300}
                  className={`aspect-square w-full rounded-xl ${fresh ? "shadow-[0_0_0_2px_color-mix(in_srgb,var(--glow-1)_70%,transparent)]" : ""}`}
                />
                <span
                  className={`absolute top-1.5 left-1.5 grid size-6 place-content-center rounded-full bg-black/[0.78] ${fresh ? "text-glow-1" : "text-white"}`}
                >
                  <Tag className="size-[13px]" aria-label={fresh ? "новое" : "знакомое"} />
                </span>
              </span>
              <b className="mt-1.5 block truncate font-extrabold text-[12.5px]">{track.title}</b>
              <small className="block truncate font-bold text-[11.5px] text-fg-faint">
                {why[0] ?? ""}
              </small>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex gap-3.5 font-bold text-[12px] text-fg-faint">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-white/30" />
          знакомое
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-[3px] bg-glow-1" />
          новое
        </span>
      </p>
      {presses.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {presses.map((press) => {
            const Icon = press.kind === "more" ? ThumbsUp : ThumbsDown;
            const words = press.kind === "more" ? "Больше такого, как" : "Меньше такого, как";
            return (
              <span
                key={`${press.kind}:${press.track.id}:${press.at}`}
                className="inline-flex h-[30px] max-w-full items-center gap-1.5 rounded-full bg-white/[0.07] pr-1.5 pl-3 font-bold text-[12.5px]"
              >
                <Icon className="size-3.5 shrink-0 text-glow-1" aria-hidden="true" />
                <span className="truncate">
                  {words} «{press.track.title}»
                </span>
                <button
                  type="button"
                  onClick={() => takeBack(press)}
                  aria-label={`Убрать: ${words.toLowerCase()} «${press.track.title}»`}
                  className="grid size-[22px] shrink-0 place-content-center rounded-full text-fg-muted transition-colors hover:bg-white/10 hover:text-fg"
                >
                  <X className="size-[13px]" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Every source: what it holds now (or why nothing yet), how often, on or off. */
function Sources() {
  const selection = useSelection();
  const settings = useSelectionSettings((s) => s.settings);
  const setSource = useSelectionSettings((s) => s.setSource);
  const rows = sourceRows({
    likes: selection.likesCount,
    counts: selection.sources,
    settings: settings.sources,
    stations: selection.seeds.stations,
    related: selection.seeds.related,
    plays: selection.plays,
    since: selection.since,
    windows: selection.windows,
    now: Date.now(),
  });
  return (
    <div>
      <h3 className={columnName}>Из чего</h3>
      <ul className="-mx-2.5 grid gap-0.5">
        {rows.map((row) => {
          const Icon = SOURCE_ICON[row.id];
          return (
            <li
              key={row.id}
              className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
            >
              <span
                className={`grid size-[34px] place-content-center rounded-[10px] ${row.on ? "bg-glow-1/15 text-glow-1" : "bg-white/[0.07] text-fg-muted"}`}
              >
                <Icon className="size-[17px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-px">
                <b className="block font-extrabold text-[14px] leading-tight">{row.name}</b>
                <small
                  className={`mt-0.5 block text-pretty font-bold text-[12.5px] leading-snug ${row.empty ? "text-fg-muted" : "text-fg-faint"}`}
                >
                  {row.line}
                </small>
                {row.on && !row.empty && (
                  <fieldset className="mt-2 flex h-7 w-max rounded-full bg-white/[0.06] p-0.5">
                    <legend className="sr-only">Как часто: {row.name}</legend>
                    {WEIGHTS.map((weight) => (
                      <button
                        key={weight}
                        type="button"
                        aria-pressed={row.weight === weight}
                        onClick={() => setSource(row.id, { weight })}
                        className="rounded-full px-2.5 font-bold text-[12px] text-fg-muted transition-colors hover:text-fg aria-pressed:bg-white/[0.14] aria-pressed:text-fg"
                      >
                        {WEIGHT_WORDS[weight]}
                      </button>
                    ))}
                  </fieldset>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={row.on}
                aria-label={row.name}
                onClick={() => setSource(row.id, { on: !row.on })}
                className="relative mt-1.5 h-[22px] w-[38px] shrink-0 rounded-full bg-white/[0.16] transition-colors after:absolute after:top-[3px] after:left-[3px] after:size-4 after:rounded-full after:bg-white after:transition-transform after:duration-200 aria-checked:bg-glow-1 aria-checked:after:translate-x-4"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** What the diary taught: counts the engine leans on, in names. */
function Known() {
  const selection = useSelection();
  const known = useMemo(
    () => whatItKnows(selection.taste, selection.names),
    [selection.taste, selection.names],
  );
  const text = "text-pretty font-semibold text-[13.5px] text-fg-muted leading-normal";
  let body: ReactNode;
  if (selection.learning === "unreadable") {
    body = (
      <p className={text}>
        Дневник сейчас не читается, поэтому подборка играет по правилам: два лайка, потом трек со
        станции.
      </p>
    );
  } else if (selection.learning === "rules") {
    body = (
      <>
        <p className={text}>
          Пока ничего: дневник пустой. Подборка играет по правилам —{" "}
          <b className="font-extrabold text-fg">два лайка, потом трек со станции</b>.
        </p>
        <p className={`mt-2 ${text}`}>
          Каждый трек, который ты дослушаешь, пропустишь или назовёшь «не то», запишется в дневник —
          и подборка начнёт учиться. Через {LEARNING_PLAYS} прослушиваний выученное станет главнее
          правил.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <p className={text}>
          {selection.learning === "learning" ? (
            <>
              Учусь:{" "}
              <b className="font-extrabold text-fg">
                {known.plays} из {LEARNING_PLAYS}
              </b>{" "}
              прослушиваний — пока правила главнее.
            </>
          ) : (
            <>
              Выучено по <b className="font-extrabold text-fg">{formatCount(known.plays)}</b>{" "}
              {plural(known.plays, ["прослушиванию", "прослушиваниям", "прослушиваниям"])} дневника.
            </>
          )}
        </p>
        {known.loved.length > 0 && <Artists title="Дослушиваешь" artists={known.loved} />}
        {known.left.length > 0 && (
          <Artists title="Бросаешь в первые секунды" artists={known.left} left />
        )}
        {known.rejected > 0 && (
          <p className={`mt-3 ${text}`}>
            «Не то» — {formatCount(known.rejected)}{" "}
            {plural(known.rejected, ["трек", "трека", "треков"])}: их подборка больше не предложит.
          </p>
        )}
      </>
    );
  }
  return (
    <div>
      <h3 className={columnName}>Что подборка знает о тебе</h3>
      {body}
    </div>
  );
}

function Artists({
  title,
  artists,
  left = false,
}: {
  title: string;
  artists: ArtistFact[];
  left?: boolean;
}) {
  return (
    <>
      <h4 className="mt-3.5 mb-1 font-extrabold text-[12.5px] text-fg-faint">{title}</h4>
      <ul>
        {artists.map((artist) => {
          const share = (left ? artist.early : artist.heardOut) / artist.plays;
          return (
            <li
              key={artist.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 border-white/5 border-b py-[7px]"
            >
              <b className="truncate font-extrabold text-[13.5px]">{artist.name}</b>
              <span className="font-bold text-[12.5px] text-fg-faint tabular-nums">
                {left ? "бросаешь" : "дослушиваешь"} {left ? artist.early : artist.heardOut} из{" "}
                {artist.plays}
              </span>
              <span className="col-span-2 mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <i
                  className={`block h-full ${left ? "bg-white/40" : "bg-linear-to-r from-glow-1 to-glow-2"}`}
                  style={{ width: `${Math.round(share * 100)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
