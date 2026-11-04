import { CornerDownLeft, History, Search, X } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { Resource, Track, User } from "@/api/types";
import { playInOrder } from "@/features/library/play";
import { bestArtist } from "@/features/search/best";
import { useQuickHits, useSuggestions } from "@/features/search/queries";
import { useSearch } from "@/features/search/store";
import { canPlay } from "@/features/selection/engine";
import { Artwork } from "@/ui/Artwork";
import { formatCount, plural } from "@/ui/format";

const isMac = /Mac/.test(navigator.userAgent);
const FOLLOWERS = ["подписчик", "подписчика", "подписчиков"] as const;

/** `value`, once it has stopped changing for `ms`. */
function useSettled(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const wait = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(wait);
  }, [value, ms]);
  return value ? settled : "";
}

interface Item {
  key: string;
  /** Completions, found things, the search itself: a line runs between groups. */
  group: "lines" | "found" | "go";
  run: () => void;
  content: ReactNode;
}

/** The typed part as typed, the rest of the suggestion brighter. */
function Completion({ output, typed }: { output: string; typed: string }) {
  if (!output.toLowerCase().startsWith(typed.toLowerCase())) {
    return <b className="font-extrabold text-fg">{output}</b>;
  }
  return (
    <>
      {output.slice(0, typed.length)}
      <b className="font-extrabold text-fg">{output.slice(typed.length)}</b>
    </>
  );
}

function Hit({
  art,
  round,
  title,
  line,
}: {
  art: string | null;
  round?: boolean;
  title: string;
  line: string;
}) {
  return (
    <>
      <Artwork
        url={art}
        size={100}
        className={`size-9 shrink-0 ${round ? "rounded-full" : "rounded-[9px]"}`}
      />
      <span className="min-w-0 text-left leading-tight">
        <b className="block truncate font-extrabold text-[14px] text-fg">{title}</b>
        <span className="block truncate font-bold text-[12.5px] text-fg-faint">{line}</span>
      </span>
    </>
  );
}

/**
 * The top bar's search. Typing offers SoundCloud's own completions and the
 * best few results at once; Enter (or a completion) opens the search page.
 * An empty field offers the recent searches. ⌘K / Ctrl+K jumps here.
 */
export function SearchField() {
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searched = useSearch((s) => s.query);
  const recent = useSearch((s) => s.recent);
  const [text, setText] = useState(searched ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = text.trim();
  const settled = useSettled(typed, 150);
  const suggestions = useSuggestions(open ? settled : "");
  const hits = useQuickHits(open ? settled : "");

  // The field shows what the page shows: a search run elsewhere, or none once it closes.
  useEffect(() => setText(searched ?? ""), [searched]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const finish = () => {
    setOpen(false);
    setActive(-1);
    input.current?.blur();
  };
  const run = (query: string) => {
    useSearch.getState().run(query);
    finish();
  };

  const items = ((): Item[] => {
    if (!typed) {
      return recent.map((query) => ({
        key: `recent:${query}`,
        group: "lines",
        run: () => run(query),
        content: (
          <>
            <History className="size-[17px] shrink-0" aria-hidden="true" />
            <span className="truncate">{query}</span>
          </>
        ),
      }));
    }
    const lines: Item[] = (suggestions.data ?? []).slice(0, 6).map((s) => ({
      key: `suggest:${s.query}`,
      group: "lines",
      run: () => run(s.query),
      content: (
        <>
          <Search className="size-[17px] shrink-0" aria-hidden="true" />
          <span className="truncate">
            <Completion output={s.output} typed={typed} />
          </span>
        </>
      ),
    }));
    const found: Resource[] = hits.data?.items ?? [];
    const people = found.filter((r): r is Resource & { kind: "user" } => r.kind === "user");
    const artist: User | null = bestArtist(people, settled, { prefix: true });
    const tracks = found
      .filter((r): r is Resource & { kind: "track" } => r.kind === "track")
      .filter(canPlay)
      .slice(0, artist ? 2 : 3);
    const quick: Item[] = [];
    if (artist) {
      quick.push({
        key: `artist:${artist.id}`,
        group: "found",
        run: () => {
          useSearch.getState().run(artist.username, { kind: "artist", user: artist });
          finish();
        },
        content: (
          <Hit
            art={artist.avatarUrl}
            round
            title={artist.username}
            line={
              artist.followersCount != null
                ? `Артист · ${formatCount(artist.followersCount)} ${plural(artist.followersCount, FOLLOWERS)}`
                : "Артист"
            }
          />
        ),
      });
    }
    for (const track of tracks) {
      quick.push({
        key: `track:${track.id}`,
        group: "found",
        run: () => {
          playInOrder(tracks as Track[], { kind: "search", title: settled }, track);
          finish();
        },
        content: (
          <Hit
            art={track.artworkUrl}
            title={track.title}
            line={`Трек · ${track.user?.username ?? ""}`}
          />
        ),
      });
    }
    return [
      ...lines,
      ...quick,
      {
        key: "go",
        group: "go",
        run: () => run(typed),
        content: (
          <>
            <CornerDownLeft className="size-[17px] shrink-0 text-glow-1" aria-hidden="true" />
            <span className="truncate text-fg">
              Искать «<b className="font-extrabold">{typed}</b>»
            </span>
          </>
        ),
      },
    ];
  })();

  const showList = open && items.length > 0;

  return (
    <div className="relative ml-auto w-[340px] min-w-[180px] shrink">
      <label className="flex h-10 items-center gap-2.5 rounded-[20px] bg-white/[0.07] pr-1.5 pl-4 text-fg-muted transition-colors focus-within:bg-white/10">
        <Search className="size-5 shrink-0" aria-hidden="true" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={(event) => {
            event.currentTarget.select();
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              const n = items.length;
              if (n) setActive((i) => (event.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const chosen = active >= 0 ? items[active] : null;
              if (chosen) chosen.run();
              else if (typed) run(typed);
            } else if (event.key === "Escape") {
              event.stopPropagation();
              if (showList) setOpen(false);
              else if (text) setText(searched ?? "");
              else input.current?.blur();
            }
          }}
          placeholder="Трек, артист, плейлист"
          aria-label="Поиск"
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent font-semibold text-fg outline-none placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {text ? (
          <button
            type="button"
            // Keeps the focus in the field.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setText("");
              setActive(-1);
              setOpen(true);
              input.current?.focus();
            }}
            aria-label="Стереть"
            className="grid size-7 shrink-0 place-content-center rounded-full text-fg-muted transition-colors hover:bg-white/10 hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <kbd className="mr-2.5 rounded-md bg-white/[0.08] px-[7px] py-1 font-bold font-sans text-[11px] leading-none">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        )}
      </label>
      {showList && (
        <div className="absolute top-12 right-0 w-[max(100%,420px)] rounded-2xl border border-line bg-panel p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]">
          {!typed && (
            <div className="flex items-baseline justify-between px-3 pt-2 pb-1.5">
              <span className="font-bold text-[12.5px] text-fg-faint">Недавние</span>
              <button
                type="button"
                onClick={() => useSearch.getState().forget()}
                className="rounded font-bold text-[12.5px] text-fg-faint transition-colors hover:text-fg"
              >
                Забыть
              </button>
            </div>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label={typed ? "Подсказки" : "Недавние поиски"}
            // Pressing in the list must not take the focus (and the list) away from the field.
            onMouseDown={(event) => event.preventDefault()}
          >
            {items.map((item, i) => (
              <Fragment key={item.key}>
                {i > 0 && items[i - 1]?.group !== item.group && (
                  <div role="presentation" className="mx-3 my-1.5 h-px bg-line" />
                )}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: the field keeps the keyboard (arrows, Enter), as a combobox does */}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === active}
                  onClick={item.run}
                  onMouseMove={() => i !== active && setActive(i)}
                  className={`flex cursor-default items-center gap-2.5 rounded-xl px-3 font-bold text-[14px] text-fg-muted aria-selected:bg-white/[0.06] aria-selected:text-fg ${item.group === "found" ? "h-[52px]" : "h-10"}`}
                >
                  {item.content}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
