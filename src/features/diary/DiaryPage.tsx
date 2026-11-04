import { useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronDown, Laptop, MapPin, Moon, Play, Sun, Sunset } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { Play as DiaryPlay } from "@/api/types";
import { useScrollRoot } from "@/app/scrollRoot";
import { zoneCityName } from "@/features/diary/cities";
import { DayStrip } from "@/features/diary/DayStrip";
import {
  type DayGroup,
  dayDate,
  dayWord,
  groupDays,
  lightLength,
  minuteClock,
  type PartGroup,
  partTitle,
  SKY_WORDS,
  type Sky,
  todayKey,
} from "@/features/diary/days";
import { KeepMenu, keepWords, PlaceMenu } from "@/features/diary/Menus";
import { PlayRow } from "@/features/diary/PlayRow";
import {
  forgetPlay,
  useDiaryDays,
  useDiaryLive,
  useDiaryPlays,
  useDiarySettings,
} from "@/features/diary/queries";
import { PageLight } from "@/features/library/PageLight";
import { FilterField, primaryButton, StageActions, StageNote } from "@/features/library/Stage";
import { currentTrack, usePlayer } from "@/features/player/store";
import { Held } from "@/features/problems/Held";
import { useLoadMore } from "@/features/search/useLoadMore";
import { canPlay } from "@/features/selection/buildQueue";
import { useSelection } from "@/features/selection/useSelection";
import { formatCount, formatLength, plural } from "@/ui/format";

/** Rows a part shows before «Ещё N треков». */
const PART_ROWS = 7;
/** Under the top bar and the stuck row: where a day counts as the one on screen. */
const READ_LINE = 220;

const tracksWord = (n: number) => `${formatCount(n)} ${plural(n, ["трек", "трека", "треков"])}`;
/** «2 ч 10 мин», or «меньше минуты» for a part just begun. */
const heardWords = (ms: number) => (ms < 60_000 ? "меньше минуты" : formatLength(ms));

const chip =
  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full bg-[rgb(10_10_12/0.66)] px-[15px] font-bold text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] backdrop-blur-[6px] transition-colors hover:bg-[rgb(40_40_46/0.72)] hover:text-white disabled:opacity-50 aria-expanded:bg-[rgb(40_40_46/0.72)] [&_svg]:size-4 [&_svg]:shrink-0";

const SKY_ICONS: Record<Sky, typeof Sun> = { light: Sun, dusk: Sunset, dark: Moon };

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Plays a part again from one of its plays, in the order it was heard. */
function playFrom(part: PartGroup, from: DiaryPlay, today: string) {
  const heard = [...part.plays].reverse().filter((play) => canPlay(play.track));
  const at = heard.findIndex((play) => play.id === from.id);
  if (at < 0) {
    usePlayer.getState().say("Этот трек здесь больше не играет");
    return;
  }
  usePlayer.getState().playQueue(
    heard.map((play) => play.track),
    at,
    { kind: "diary", title: partTitle(part.part, part.day, today) },
  );
}

function PartBlock({
  part,
  today,
  open,
  onOpen,
  nowId,
}: {
  part: PartGroup;
  today: string;
  open: boolean;
  onOpen: () => void;
  /** The track sounding (or paused) in the player. */
  nowId: number | null;
}) {
  const client = useQueryClient();
  const shown = open ? part.plays : part.plays.slice(0, PART_ROWS);
  const hidden = part.plays.length - shown.length;
  const first = part.plays.at(-1);
  const SkyIcon = part.sky ? SKY_ICONS[part.sky] : null;
  return (
    <div className="rounded-[22px] bg-panel p-1.5 [&+&]:mt-3">
      <div className="flex h-[52px] items-center gap-3 pr-3 pl-2.5">
        <button
          type="button"
          disabled={!first}
          onClick={() => first && playFrom(part, first, today)}
          aria-label={`Включить снова: ${part.name}`}
          title="Включить снова, по порядку"
          className="grid size-9 shrink-0 place-content-center rounded-full bg-white text-ink transition-transform duration-150 hover:scale-[1.06] active:scale-95"
        >
          <Play className="size-4 translate-x-px fill-current stroke-none" aria-hidden="true" />
        </button>
        <h3 className="font-extrabold text-[15.5px]">{part.name}</h3>
        <span className="font-bold text-[13px] text-fg-faint tabular-nums">
          {part.span} · {tracksWord(part.plays.length)} · {heardWords(part.heardMs)}
        </span>
        {part.sky && SkyIcon && (
          <span className="ml-auto inline-flex items-center gap-1.5 font-bold text-[12.5px] text-fg-faint">
            <SkyIcon className="size-[15px]" aria-hidden="true" />
            {SKY_WORDS[part.sky]}
          </span>
        )}
      </div>
      {shown.map((play) => {
        const now = play.outcome === null && play.track.id === nowId;
        return (
          <PlayRow
            key={play.id}
            play={play}
            now={now}
            onPlay={() => (now ? usePlayer.getState().toggle() : playFrom(part, play, today))}
            onForget={() => forgetPlay(play, client)}
          />
        );
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="my-1 ml-[66px] flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 font-bold text-[13.5px] transition-colors hover:bg-white/[0.16]"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
          Ещё {tracksWord(hidden)}
        </button>
      )}
    </div>
  );
}

function DaySection({
  day,
  today,
  opened,
  onOpen,
  showAll,
  nowId,
}: {
  day: DayGroup;
  today: string;
  opened: ReadonlySet<string>;
  onOpen: (part: string) => void;
  showAll: boolean;
  nowId: number | null;
}) {
  const heading = `day-${day.key}-title`;
  return (
    <section
      id={`day-${day.key}`}
      data-day={day.key}
      aria-labelledby={heading}
      className="mt-9 scroll-mt-[156px] first-of-type:mt-6"
    >
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 px-2.5 pb-3">
        <h2
          id={heading}
          className="font-bold font-display text-[22px] leading-none tracking-[-0.02em]"
        >
          {dayWord(day.key, today)}
          <span className="text-fg-muted">, {dayDate(day.key, today)}</span>
        </h2>
        <span className="font-bold text-[13px] text-fg-faint tabular-nums">
          {heardWords(day.heardMs)} музыки · {tracksWord(day.count)}
        </span>
        {day.rise !== null && day.set !== null && (
          <span className="ml-auto inline-flex items-center gap-1.5 font-bold text-[13px] text-fg-faint tabular-nums">
            <Sun className="size-[15px]" aria-hidden="true" />
            {minuteClock(day.rise)}–{minuteClock(day.set)} · светло {lightLength(day.rise, day.set)}
          </span>
        )}
      </header>
      {day.parts.map((part) => (
        <PartBlock
          key={part.key}
          part={part}
          today={today}
          open={showAll || opened.has(part.key)}
          onOpen={() => onOpen(part.key)}
          nowId={nowId}
        />
      ))}
    </section>
  );
}

/** Quiet shapes in the diary's own rhythm while it reads. */
function DaySkeleton() {
  return (
    <div aria-hidden="true" className="mt-6 animate-pulse">
      <div className="mx-2.5 mb-4 h-[22px] w-64 rounded-lg bg-panel" />
      <div className="rounded-[22px] bg-panel p-1.5">
        <div className="h-[52px]" />
        {Array.from({ length: 5 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: shapes with nothing to tell them apart
          <div key={i} className="flex h-14 items-center gap-3 px-2.5">
            <span className="w-[46px]" />
            <span className="size-11 rounded-[9px] bg-panel-hover" />
            <span className="h-3 w-1/3 rounded bg-panel-hover" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A diary with nothing in it yet says what it will hold, and starts the music. */
function EmptyDiary() {
  const selection = useSelection();
  return (
    <div className="mt-8 max-w-[640px] rounded-[22px] bg-panel px-7 py-[26px]">
      <h2 className="font-extrabold text-[17px]">Пока здесь пусто</h2>
      <p className="mt-2 text-pretty text-[14.5px] text-fg-muted leading-[1.5]">
        Дневник пишется сам с первого звука: каждая строчка — час, трек, откуда он и чем закончился.
        Ночь, утро, день и вечер соберутся сами. Всё лежит только на этом компьютере.
      </p>
      <button
        type="button"
        disabled={selection.status !== "ready"}
        onClick={() => selection.start()}
        className={`mt-5 ${primaryButton}`}
      >
        <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
        Включить подборку
      </button>
    </div>
  );
}

function SettingChip({
  icon,
  label,
  open,
  disabled,
  onOpen,
  children,
}: {
  icon: ReactNode;
  label: string;
  open: boolean;
  disabled: boolean;
  onOpen: (anchor: HTMLElement) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label}
      onClick={(event) => onOpen(event.currentTarget)}
      className={chip}
    >
      {icon}
      {children}
      <ChevronDown className="!size-[15px] opacity-70" aria-hidden="true" />
    </button>
  );
}

/**
 * «Дневник»: what played in Cloudify, a page per day — its night, morning,
 * day and evening, newest first — and how each play ended. Every part plays
 * again in its own order; the strip of days goes to any day; it is all kept
 * on this computer for as long as the person says.
 */
export function DiaryPage() {
  const today = todayKey();
  const [query, setQuery] = useState("");
  const find = useDebounced(query.trim(), 200);
  const plays = useDiaryPlays(find);
  const days = useDiaryDays();
  const settings = useDiarySettings();
  useDiaryLive();
  const groups = useMemo(() => groupDays(plays.items), [plays.items]);
  const nowId = usePlayer((s) => currentTrack(s)?.id ?? null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState<{ kind: "keep" | "place"; anchor: HTMLElement } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const scroller = useScrollRoot();
  const list = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useLoadMore(end, plays);

  const firstDay = groups[0]?.key ?? null;
  // The day at the top of the screen is the one lit on the strip.
  useEffect(() => {
    if (!scroller) return;
    let frame = 0;
    const spy = () => {
      frame = 0;
      const sections = list.current?.querySelectorAll<HTMLElement>("[data-day]") ?? [];
      let at = sections[0]?.dataset.day ?? firstDay;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= READ_LINE) at = section.dataset.day ?? at;
      }
      setCurrent(at);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(spy);
    };
    spy();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scroller, firstDay]);

  // A day picked on the strip: brought in page by page if it is not read yet, then shown.
  useEffect(() => {
    if (!target) return;
    const node = document.getElementById(`day-${target}`);
    if (node) {
      node.scrollIntoView({ block: "start", behavior: "smooth" });
      setTarget(null);
      return;
    }
    const oldest = groups.at(-1)?.key;
    if (plays.hasMore && (!oldest || oldest > target)) {
      if (!plays.loadingMore) plays.loadMore();
    } else setTarget(null);
  }, [target, groups, plays]);

  const data = settings.data;
  const place = data?.city?.name ?? (data?.zone ? zoneCityName(data.zone.zone) : null);
  const guessed = data ? data.city === null && data.zone !== null : false;
  const toggleMenu = (kind: "keep" | "place") => (anchor: HTMLElement) =>
    setMenu((open) => (open?.kind === kind ? null : { kind, anchor }));

  let body: ReactNode;
  if (plays.pending) body = <DaySkeleton />;
  else if (plays.error && plays.items.length === 0)
    body = <Held error={plays.error} frames={<DaySkeleton />} className="mt-6" />;
  else if (plays.items.length === 0)
    body = find ? (
      <div className="mt-6">
        <StageNote text={`В дневнике нет «${find}». Ищется по названию трека и артисту.`} />
      </div>
    ) : (
      <EmptyDiary />
    );
  else
    body = (
      <div ref={list}>
        {groups.map((day) => (
          <DaySection
            key={day.key}
            day={day}
            today={today}
            opened={opened}
            onOpen={(part) => setOpened((all) => new Set(all).add(part))}
            showAll={find !== ""}
            nowId={nowId}
          />
        ))}
        <div ref={end} />
        {plays.loadingMore && <DaySkeleton />}
        {plays.error && <Held error={plays.error} rest className="mt-4" />}
      </div>
    );

  return (
    // The ground behind the light is what its grain blends into; without it the grain shows as haze.
    <div className="relative isolate min-h-full bg-ground">
      <PageLight cover={null} />
      <div className="@container relative z-10 px-14 pb-16">
        <h1 className="whitespace-nowrap pt-[clamp(88px,13vh,104px)] font-display font-extrabold text-[length:min(108px,12.5cqi)] leading-[0.92] tracking-[-0.055em] [text-shadow:0_10px_50px_rgb(0_0_0/0.35)]">
          Дневник
        </h1>
        <p className="mt-[18px] max-w-[60ch] text-pretty text-[17px] text-white/80 leading-[1.45] [text-shadow:0_2px_16px_rgb(0_0_0/0.4)]">
          Что играло в Cloudify — по дням и частям суток, и чем закончился каждый трек. Нажми на
          строчку — заиграет оттуда.
        </p>
        <div className="mt-[22px] flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center gap-2 pr-1 font-bold text-white/80 [text-shadow:0_2px_16px_rgb(0_0_0/0.4)]">
            <Laptop className="size-[17px]" aria-hidden="true" />
            Только на этом компьютере
          </span>
          <SettingChip
            icon={<Archive aria-hidden="true" />}
            label={`Хранить ${data ? keepWords(data.keepDays) : ""}: сколько хранить дневник`}
            open={menu?.kind === "keep"}
            disabled={!data}
            onOpen={toggleMenu("keep")}
          >
            Хранить {data ? keepWords(data.keepDays) : "…"}
          </SettingChip>
          <SettingChip
            icon={<MapPin aria-hidden="true" />}
            label={`Свет и темнота: ${place ?? "город не выбран"}. Где ты`}
            open={menu?.kind === "place"}
            disabled={!data}
            onOpen={toggleMenu("place")}
          >
            Свет и темнота: {place ?? "город не выбран"}
            {guessed && <span className="font-bold opacity-60">· по часовому поясу</span>}
          </SettingChip>
        </div>
        <div className="h-3.5" />
        <StageActions jump={false}>
          <FilterField value={query} onChange={setQuery} placeholder="Найти в дневнике" />
          <DayStrip days={days.data ?? []} today={today} current={current} onPick={setTarget} />
        </StageActions>
        {body}
      </div>
      {menu?.kind === "keep" && data && (
        <KeepMenu anchor={menu.anchor} settings={data} onClose={() => setMenu(null)} />
      )}
      {menu?.kind === "place" && data && (
        <PlaceMenu anchor={menu.anchor} settings={data} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
