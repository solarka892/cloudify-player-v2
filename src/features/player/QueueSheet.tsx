import { useVirtualizer } from "@tanstack/react-virtual";
import { AudioLines, GripVertical, ListX, Pause, Play, X } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useOpener } from "@/features/library/nav";
import { usePanels } from "@/features/player/panels";
import { type QueueEntry, split } from "@/features/player/queue";
import { aheadFrom, fromTitle } from "@/features/player/source";
import { type Repeat, usePlayer } from "@/features/player/store";
import { Artwork } from "@/ui/Artwork";
import { formatCount, formatDuration, formatLength, plural } from "@/ui/format";
import { stateBadge } from "@/ui/trackState";

// «Дальше»: the queue rises out of the player's queue button over whatever is
// on the page — what plays, where the queue came from, what comes next and
// what already played. Jump to any track, take one out, clear what is next,
// drag a row by its grip (or Alt+↑/↓) to move it.

const ROW = 56;
const HEAD = 34;
const END = 62;
/** How close to the list's edge a dragged row has to come before the list scrolls. */
const EDGE = 48;

type Item =
  | { kind: "head"; key: string; label: string }
  | { kind: "row"; key: number; entry: QueueEntry; drag: boolean }
  | { kind: "end"; key: string; text: string };

const heightOf = (item: Item | undefined) =>
  item?.kind === "row" ? ROW : item?.kind === "head" ? HEAD : END;

const tracksWord = (n: number) => `${formatCount(n)} ${plural(n, ["трек", "трека", "треков"])}`;

/** How the queue will really end, said where it ends. */
function endNote(repeat: Repeat, endless: boolean, anything: boolean): string {
  if (endless) return "Подборка не кончится: ближе к концу она добавит ещё похожих.";
  if (repeat === "one") return "Сейчас повтор трека: он играет по кругу, пока не выключишь (R).";
  if (repeat === "all") return "Потом снова с первого трека: включён повтор очереди.";
  return anything
    ? "Потом тишина. R включает повтор, чтобы очередь шла по кругу."
    : "Дальше ничего нет: когда этот трек кончится, музыка остановится.";
}

interface Drag {
  key: number;
  /** Positions among the rows that can move. */
  from: number;
  to: number;
  /** Where the pointer is, and where it held the row. */
  y: number;
  grab: number;
  left: number;
  width: number;
}

export function QueueSheet() {
  // The key help covers the bar's width: the queue steps aside meanwhile and comes back after.
  const open = usePanels((s) => s.queue && !s.keys);
  return open ? <Sheet /> : null;
}

function Sheet() {
  const box = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const original = usePlayer((s) => s.original);
  const heard = usePlayer((s) => s.heard);
  const source = usePlayer((s) => s.source);
  const repeat = usePlayer((s) => s.repeat);
  const playing = usePlayer((s) => s.playing);
  const endless = usePlayer((s) => Boolean(s.options.refill));
  const { jump, remove, move, moveBy, clearAhead, toggleShuffle, toggle } = usePlayer.getState();
  const open = useOpener();
  const [tab, setTab] = useState<"ahead" | "before">("ahead");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const close = useCallback(() => usePanels.getState().showQueue(false), []);

  const parts = useMemo(() => split({ queue, index, original }), [queue, index, original]);
  const shown = tab === "before" && parts.before.length > 0 ? "before" : "ahead";
  const allHeard = parts.before.every((e) => heard.has(e.key));

  const items = useMemo((): Item[] => {
    if (!parts.now) return [];
    if (shown === "before") {
      return [...parts.before]
        .reverse()
        .map((entry) => ({ kind: "row", key: entry.key, entry, drag: false }));
    }
    const out: Item[] = [];
    const rows = (list: readonly QueueEntry[]) =>
      list.map((entry): Item => ({ kind: "row", key: entry.key, entry, drag: true }));
    if (parts.mine.length > 0)
      out.push({ kind: "head", key: "mine", label: "Ты добавил" }, ...rows(parts.mine));
    if (parts.rest.length > 0)
      out.push({ kind: "head", key: "rest", label: aheadFrom(source) }, ...rows(parts.rest));
    out.push({ kind: "end", key: "end", text: endNote(repeat, endless, parts.ahead.length > 0) });
    return out;
  }, [parts, shown, source, repeat, endless]);

  /** Where each item starts: rows and names have fixed heights, so the list is known without measuring. */
  const starts = useMemo(() => {
    let at = 0;
    return items.map((item) => {
      const start = at;
      at += heightOf(item);
      return start;
    });
  }, [items]);
  const movable = useMemo(
    () => items.flatMap((item, i) => (item.kind === "row" && item.drag ? [{ item, i }] : [])),
    [items],
  );

  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: (i) => heightOf(items[i]),
    getItemKey: (i) => items[i]?.key ?? i,
    overscan: 8,
  });

  // Outside presses close it; the player bar, a menu over it and the key help do not count.
  useEffect(() => {
    const onPointer = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || box.current?.contains(target)) return;
      if (target.closest("[data-player-bar], [role='menu'], [data-keys-help]")) return;
      close();
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [close]);

  // It takes the keyboard when it opens and hands it back to the queue button when it closes.
  useEffect(() => {
    const node = box.current;
    node?.focus({ preventScroll: true });
    return () => {
      const here = document.activeElement;
      if (here === document.body || (node && here && node.contains(here))) {
        document.querySelector<HTMLElement>("[aria-controls='queue-sheet']")?.focus();
      }
    };
  }, []);

  // A row the keyboard moved to (or moved) gets the focus once it is on screen.
  useLayoutEffect(() => {
    if (focusKey === null) return;
    const at = items.findIndex((item) => item.key === focusKey);
    if (at < 0) {
      setFocusKey(null);
      return;
    }
    const button = scroller.current?.querySelector<HTMLElement>(`[data-key="${focusKey}"]`);
    if (button) {
      button.focus({ preventScroll: true });
      setFocusKey(null);
    } else virtual.scrollToIndex(at, { align: "auto" });
  });

  const rowKeys = (event: KeyboardEvent, item: Item & { kind: "row" }) => {
    const rows = items.flatMap((x) => (x.kind === "row" ? [x] : []));
    const at = rows.findIndex((x) => x.key === item.key);
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      if (event.altKey) {
        if (item.drag && moveBy(item.key, step)) setFocusKey(item.key);
        return;
      }
      const target = rows[at + step];
      if (target) setFocusKey(target.key);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const target = event.key === "Home" ? rows[0] : rows[rows.length - 1];
      if (target) setFocusKey(target.key);
    } else if ((event.key === "Delete" || event.key === "Backspace") && item.drag) {
      event.preventDefault();
      setFocusKey((rows[at + 1] ?? rows[at - 1])?.key ?? null);
      remove(item.key);
    }
  };

  // --- dragging by the grip ----------------------------------------------------
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  /** Which place among the movable rows the pointer at `y` (window coordinates) points to. */
  const slotAt = useCallback(
    (y: number, from: number) => {
      const list = scroller.current;
      if (!list) return from;
      const inside = y - list.getBoundingClientRect().top + list.scrollTop;
      let slot = 0;
      movable.forEach(({ i }, n) => {
        if (n !== from && inside > (starts[i] ?? 0) + ROW / 2) slot += 1;
      });
      return slot;
    },
    [movable, starts],
  );

  const startDrag = (event: PointerEvent, key: number) => {
    if (event.button !== 0) return;
    const from = movable.findIndex(({ item }) => item.key === key);
    const row = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-row]");
    if (from < 0 || !row) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    setDrag({
      key,
      from,
      to: from,
      y: event.clientY,
      grab: event.clientY - rect.top,
      left: rect.left,
      width: rect.width,
    });
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const follow = (y: number) => setDrag((d) => (d ? { ...d, y, to: slotAt(y, d.from) } : d));
    const onMove = (event: globalThis.PointerEvent) => follow(event.clientY);
    const finish = (commit: boolean) => {
      const d = dragRef.current;
      setDrag(null);
      if (!commit || !d || d.to === d.from) return;
      const others = movable.filter((_, n) => n !== d.from);
      move(d.key, others[d.to]?.item.key ?? null);
    };
    const onUp = () => finish(true);
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(false);
    };
    // Near the list's top or bottom edge the list scrolls on its own.
    const edge = () => {
      const d = dragRef.current;
      const list = scroller.current;
      if (d && list) {
        const r = list.getBoundingClientRect();
        const speed =
          d.y < r.top + EDGE
            ? -Math.ceil((r.top + EDGE - d.y) / 4)
            : d.y > r.bottom - EDGE
              ? Math.ceil((d.y - r.bottom + EDGE) / 4)
              : 0;
        if (speed !== 0) {
          list.scrollTop += speed;
          follow(d.y);
        }
      }
      frame = requestAnimationFrame(edge);
    };
    frame = requestAnimationFrame(edge);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey, true);
    document.body.style.cursor = "grabbing";
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.cursor = "";
    };
  }, [dragging, movable, move, slotAt]);

  /** While a row is dragged, the rows between its place and the gap slide over by one. */
  const shiftOf = (key: number) => {
    if (!drag) return 0;
    const n = movable.findIndex(({ item }) => item.key === key);
    if (n < 0 || n === drag.from) return 0;
    if (drag.from < drag.to && n > drag.from && n <= drag.to) return -ROW;
    if (drag.to < drag.from && n >= drag.to && n < drag.from) return ROW;
    return 0;
  };

  const now = parts.now;
  const track = now?.track ?? null;
  const ahead = parts.ahead;
  const left = ahead.reduce((ms, e) => ms + e.track.durationMs, 0);
  const firstRow = items.find((item) => item.kind === "row")?.key ?? null;
  const tabbable =
    activeKey !== null && items.some((x) => x.key === activeKey) ? activeKey : firstRow;
  const dragged = drag ? movable[drag.from]?.item : null;

  return (
    <section
      ref={box}
      id="queue-sheet"
      role="dialog"
      aria-label="Очередь"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && firstRow !== null) {
          event.preventDefault();
          setFocusKey(firstRow);
        }
      }}
      className="sheet-rise fixed right-4 bottom-24 z-40 flex h-[min(660px,calc(100vh-180px))] w-[min(430px,calc(100vw-32px))] flex-col rounded-[22px] border border-line bg-panel shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)] outline-none"
    >
      <header className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 pt-4 pb-3.5">
        <button
          type="button"
          onClick={toggle}
          disabled={!track}
          aria-label={playing ? "Пауза" : "Играть"}
          className="relative size-[72px] rounded-xl"
        >
          <Artwork url={track?.artworkUrl ?? null} size={300} className="size-[72px] rounded-xl" />
          {track && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 bottom-1.5 grid size-[26px] place-content-center rounded-full bg-black/70 text-glow-1"
            >
              {playing ? (
                <AudioLines className="size-[15px]" />
              ) : (
                <Pause className="size-[13px] fill-current stroke-none" />
              )}
            </span>
          )}
        </button>
        <div className="min-w-0">
          <b
            title={track?.title}
            className={`block truncate font-extrabold text-[15.5px] leading-tight ${track ? "text-glow-1" : ""}`}
          >
            {track ? track.title : "Ничего не играет"}
          </b>
          {track?.user && (
            <button
              type="button"
              onClick={() => track.user && open.artist(track.user)}
              className="block max-w-full truncate rounded text-left font-bold text-[13px] text-fg-muted transition-colors hover:text-fg"
            >
              {track.user.username}
            </button>
          )}
          {track && (
            <p className="mt-1.5 font-bold text-[12.5px] text-fg-faint leading-snug">
              {source?.kind === "selection" ? (
                "Подборка — подбирается сама, пока слушаешь"
              ) : (
                <>
                  {fromTitle(source) && `${fromTitle(source)} · `}
                  {tracksWord(queue.length)} {original ? "вперемешку" : "по порядку"} ·{" "}
                  <button
                    type="button"
                    onClick={toggleShuffle}
                    className="rounded font-extrabold text-glow-1 underline-offset-2 hover:underline"
                  >
                    {original ? "вернуть порядок" : "перемешать"}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть очередь"
          title="Закрыть (Q)"
          className="grid size-8 place-content-center self-start rounded-full text-fg-muted transition-colors hover:bg-white/[0.08] hover:text-fg"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      {now && (
        // biome-ignore lint/a11y/useSemanticElements: a group of two toggle buttons, not a form field set
        <div role="group" aria-label="Что показать" className="flex gap-1.5 px-4 pb-2">
          <Toggle on={shown === "ahead"} onClick={() => setTab("ahead")} count={ahead.length}>
            Дальше
          </Toggle>
          {parts.before.length > 0 && (
            <Toggle
              on={shown === "before"}
              onClick={() => setTab("before")}
              count={parts.before.length}
            >
              {allHeard ? "Уже играло" : "Выше в списке"}
            </Toggle>
          )}
        </div>
      )}

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 [mask-image:linear-gradient(transparent,#000_8px,#000_calc(100%-24px),transparent)]"
      >
        {now ? (
          <div className="relative" style={{ height: virtual.getTotalSize() }}>
            {virtual.getVirtualItems().map((v) => {
              const item = items[v.index];
              if (!item) return null;
              if (item.kind === "head") {
                return (
                  <h3
                    key={item.key}
                    className="absolute inset-x-0 top-0 flex h-[34px] items-end truncate px-3 pb-1.5 font-bold text-[12.5px] text-fg-faint"
                    style={{ transform: `translateY(${v.start}px)` }}
                  >
                    {item.label}
                  </h3>
                );
              }
              if (item.kind === "end") {
                return (
                  <p
                    key={item.key}
                    className="absolute inset-x-0 top-0 px-3 pt-3.5 font-bold text-[12.5px] text-fg-faint leading-normal"
                    style={{ transform: `translateY(${v.start}px)` }}
                  >
                    {item.text}
                  </p>
                );
              }
              return (
                <QueueRow
                  key={item.key}
                  item={item}
                  top={v.start + shiftOf(item.key)}
                  sliding={dragging}
                  lifted={drag?.key === item.key}
                  heard={shown === "before"}
                  tagMine={item.entry.added && parts.mine.every((e) => e.key !== item.key)}
                  tabbable={tabbable === item.key}
                  onPlay={() => jump(item.key)}
                  onRemove={() => remove(item.key)}
                  onGrip={(event) => startDrag(event, item.key)}
                  onKeyDown={(event) => rowKeys(event, item)}
                  onFocus={() => setActiveKey(item.key)}
                />
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-7 text-fg-muted leading-normal">
            <b className="mb-1.5 block font-extrabold text-[15px] text-fg">Очередь пуста</b>
            Включи что-нибудь — лайки, плейлист или подборку, и здесь будет видно, что играет
            дальше.
          </div>
        )}
      </div>

      {now && (
        <footer className="flex items-center gap-2.5 px-4 pt-2 pb-3">
          <span className="min-w-0 flex-1 truncate font-bold text-[12.5px] text-fg-faint tabular-nums">
            {ahead.length > 0 && `Впереди ${tracksWord(ahead.length)} · ${formatLength(left)}`}
          </span>
          <button
            type="button"
            onClick={clearAhead}
            disabled={ahead.length === 0}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 font-bold text-[13.5px] transition-colors hover:bg-white/[0.16] disabled:opacity-40 disabled:hover:bg-white/10"
          >
            <ListX className="size-4" aria-hidden="true" />
            Очистить дальше
          </button>
        </footer>
      )}

      {drag &&
        dragged?.kind === "row" &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[60] rounded-xl bg-panel-hover shadow-[0_18px_40px_-12px_rgb(0_0_0/0.85),inset_0_0_0_1px_rgb(255_255_255/0.16)]"
            style={{
              left: drag.left,
              top: drag.y - drag.grab,
              width: drag.width,
              height: ROW,
            }}
          >
            <RowBody entry={dragged.entry} grip />
          </div>,
          document.body,
        )}
    </section>
  );
}

function Toggle({
  on,
  onClick,
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 font-bold text-[13px] transition-colors ${
        on ? "bg-white text-ink" : "bg-white/[0.06] text-fg-muted hover:text-fg"
      }`}
    >
      {children}
      <small className="font-bold text-[12px] tabular-nums opacity-60">{formatCount(count)}</small>
    </button>
  );
}

interface RowProps {
  item: Item & { kind: "row" };
  top: number;
  /** Rows slide into their new places while one is being dragged. */
  sliding: boolean;
  lifted: boolean;
  heard: boolean;
  tagMine: boolean;
  tabbable: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onGrip: (event: PointerEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onFocus: () => void;
}

/** One queued track: press to play it, its artist opens them, the grip moves it, × takes it out. */
function QueueRow({
  item,
  top,
  sliding,
  lifted,
  heard,
  tagMine,
  tabbable,
  onPlay,
  onRemove,
  onGrip,
  onKeyDown,
  onFocus,
}: RowProps) {
  const { entry, drag } = item;
  const track = entry.track;
  return (
    <div
      data-row
      className={`group/row absolute inset-x-0 top-0 h-14 rounded-xl transition-colors duration-150 focus-within:bg-white/5 hover:bg-white/5 ${lifted ? "opacity-0" : ""}`}
      style={{
        transform: `translateY(${top}px)`,
        transition: sliding ? "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)" : undefined,
      }}
    >
      {/* The whole row plays; the grip, the artist and × sit above it. */}
      <button
        type="button"
        data-key={entry.key}
        tabIndex={tabbable ? 0 : -1}
        onClick={onPlay}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        aria-label={`${track.title}${track.user ? ` — ${track.user.username}` : ""}`}
        aria-keyshortcuts={drag ? "Enter Delete Alt+ArrowUp Alt+ArrowDown" : "Enter"}
        className="absolute inset-0 rounded-xl outline-offset-[-2px]"
      />
      <RowBody
        entry={entry}
        grip={drag}
        heard={heard}
        tagMine={tagMine}
        onGrip={onGrip}
        onRemove={drag ? onRemove : undefined}
      />
    </div>
  );
}

function RowBody({
  entry,
  grip = false,
  heard = false,
  tagMine = false,
  onGrip,
  onRemove,
}: {
  entry: QueueEntry;
  grip?: boolean;
  heard?: boolean;
  tagMine?: boolean;
  onGrip?: ((event: PointerEvent) => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const open = useOpener();
  const track = entry.track;
  const badge = stateBadge(track);
  const artist = track.user;
  const dim = heard
    ? "opacity-45 group-hover/row:opacity-80 group-focus-within/row:opacity-80"
    : "";
  // A row in the list shows its grip on hover; the one being dragged always does.
  const gripLook = !grip
    ? "opacity-0"
    : onGrip
      ? "pointer-events-auto cursor-grab opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
      : "opacity-100";
  return (
    <div className="pointer-events-none relative grid h-full grid-cols-[16px_44px_minmax(0,1fr)_auto] items-center gap-2.5 pr-2 pl-1">
      <span
        aria-hidden="true"
        onPointerDown={grip ? onGrip : undefined}
        title={grip && onGrip ? "Потяни, чтобы переставить" : undefined}
        className={`grid h-full touch-none place-content-center text-fg-faint transition-opacity duration-150 ${gripLook}`}
      >
        {grip && <GripVertical className="size-4" />}
      </span>
      <span className={`relative size-11 ${dim}`}>
        <Artwork url={track.artworkUrl} size={100} className="size-11 rounded-[9px]" />
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-content-center rounded-[9px] bg-black/45 text-white opacity-0 transition-opacity duration-150 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
        >
          <Play className="size-[18px] translate-x-px fill-current stroke-none" />
        </span>
      </span>
      <span className={`min-w-0 ${dim}`}>
        <b
          title={track.title}
          className="block truncate font-extrabold text-[14.5px] leading-tight"
        >
          {track.title}
        </b>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {badge && (
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-white/[0.07] px-2 py-1 font-extrabold text-[11px] text-fg-muted leading-none">
              {badge}
            </span>
          )}
          {tagMine && (
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-glow-1/15 px-2 py-1 font-extrabold text-[11px] text-glow-1 leading-none">
              ты добавил
            </span>
          )}
          {artist && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => open.artist(artist)}
              className="pointer-events-auto min-w-0 truncate rounded text-left font-semibold text-[13px] text-fg-muted transition-colors hover:text-fg"
            >
              {artist.username}
            </button>
          )}
        </span>
      </span>
      <span className="flex items-center gap-0.5">
        <span className="min-w-10 text-right font-bold text-[12.5px] text-fg-faint tabular-nums">
          {formatDuration(track.durationMs)}
        </span>
        {onRemove ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={onRemove}
            aria-label={`Убрать «${track.title}» из очереди`}
            title="Убрать из очереди"
            className="pointer-events-auto grid size-8 place-content-center rounded-full text-fg-muted opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-white/[0.08] hover:text-fg group-focus-within/row:opacity-100 group-hover/row:opacity-100"
          >
            <X className="size-[17px]" aria-hidden="true" />
          </button>
        ) : (
          <span className="w-8" />
        )}
      </span>
    </div>
  );
}
