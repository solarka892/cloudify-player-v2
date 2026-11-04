import { Check, Search } from "lucide-react";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DiaryCity, DiarySettings } from "@/api/types";
import { citiesMatching, zoneCityName } from "@/features/diary/cities";
import { useChooseCity, useEraseDiary, useKeepDays } from "@/features/diary/queries";
import { formatCount, plural } from "@/ui/format";

// The diary's two settings, each in a small panel that drops from its chip:
// how long plays are kept (and erasing them), and the city the light and the
// dark are worked out for.

const WIDTH = 340;
/** The top bar above, the player bar below: a panel stays between them. */
const TOP = 76;
const BOTTOM = 96;

/**
 * A panel under (or, without room, over) the chip it drops from. Escape, a
 * press elsewhere, a resize or a scroll close it, and the focus goes back to
 * the chip.
 */
function Panel({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const rect = anchor.getBoundingClientRect();
    const natural = node.scrollHeight;
    const below = window.innerHeight - BOTTOM - (rect.bottom + 8);
    const above = rect.top - 8 - TOP;
    const down = natural <= below || below >= above;
    const height = Math.min(natural, down ? below : above);
    setPlace({
      left: Math.min(window.innerWidth - WIDTH - 16, Math.max(16, rect.left)),
      top: down ? rect.bottom + 8 : rect.top - 8 - height,
      height,
    });
  }, [anchor]);

  useEffect(() => {
    const close = () => {
      onClose();
      anchor.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      // The chip toggles the panel itself.
      if (!box.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    const onScroll = (event: Event) => {
      // Scrolling the panel's own list is not leaving it.
      if (!box.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={label}
      style={
        place
          ? { left: place.left, top: place.top, maxHeight: place.height, width: WIDTH }
          : { left: -9999, top: 0, width: WIDTH }
      }
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-panel p-2 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)] drop-in"
    >
      {children}
    </div>,
    document.body,
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="shrink-0 px-2.5 pt-2.5 pb-1.5 font-bold font-display text-[15px] leading-none tracking-[-0.02em]">
      {children}
    </h3>
  );
}

function PanelText({ children }: { children: ReactNode }) {
  return (
    <p className="shrink-0 text-pretty px-2.5 pt-1 pb-2 text-[13px] text-fg-muted leading-[1.45]">
      {children}
    </p>
  );
}

const option =
  "flex h-10 w-full shrink-0 items-center gap-2.5 rounded-xl px-3 text-left font-bold text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg focus-visible:bg-white/[0.06] focus-visible:text-fg aria-checked:bg-white/10 aria-checked:text-fg";

/** Arrows move between a panel's options, as in a menu. */
function moveWithArrows(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-option]")];
  if (items.length === 0) return;
  event.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === "ArrowDown" ? at + 1 : at - 1;
  items[(next + items.length) % items.length]?.focus();
}

const KEEP: readonly [number | null, string][] = [
  [30, "30 дней"],
  [180, "180 дней"],
  [365, "Год"],
  [null, "Всегда"],
];

/** «всегда», «год», «180 дней»: how long, as the chip says it. */
export function keepWords(days: number | null): string {
  if (days === null) return "всегда";
  if (days === 365) return "год";
  return `${formatCount(days)} ${plural(days, ["день", "дня", "дней"])}`;
}

/** How long plays are kept; and, under a line, erasing them, asked once in place. */
export function KeepMenu({
  anchor,
  settings,
  onClose,
}: {
  anchor: HTMLElement;
  settings: DiarySettings;
  onClose: () => void;
}) {
  const keep = useKeepDays();
  const erase = useEraseDiary();
  const [asking, setAsking] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus();
  }, []);
  useEffect(() => {
    if (asking) yes.current?.focus();
  }, [asking]);

  const count = `${formatCount(settings.plays)} ${plural(settings.plays, ["запись", "записи", "записей"])}`;
  return (
    <Panel anchor={anchor} label="Сколько хранить дневник" onClose={onClose}>
      <PanelTitle>Сколько хранить</PanelTitle>
      <PanelText>
        Дневник лежит только на этом компьютере и никуда не отправляется. Что старше срока,
        стирается само.
      </PanelText>
      <div ref={list} role="menu" aria-label="Срок" onKeyDown={moveWithArrows}>
        {KEEP.map(([days, name]) => {
          const on = settings.keepDays === days;
          return (
            <button
              key={name}
              type="button"
              role="menuitemradio"
              data-option
              aria-checked={on}
              onClick={() => {
                if (!on) keep.mutate(days);
                onClose();
              }}
              className={option}
            >
              <span className="flex-1">{name}</span>
              {on && <Check className="size-[17px] text-glow-1" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <hr className="mx-1 my-1.5 shrink-0 border-line" />
      {asking ? (
        <div className="shrink-0 px-2.5 pt-1 pb-1.5">
          <p className="text-[13px] text-fg-muted leading-[1.45]">
            Сотру {count}. Вернуть их будет нельзя.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              ref={yes}
              type="button"
              onClick={() => {
                erase.mutate();
                onClose();
              }}
              className="h-[34px] rounded-full bg-white px-3.5 font-extrabold text-[13.5px] text-ink transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
            >
              Стереть
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="h-[34px] rounded-full bg-white/10 px-3.5 font-extrabold text-[13.5px] transition-colors hover:bg-white/[0.16]"
            >
              Не надо
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={settings.plays === 0}
          onClick={() => setAsking(true)}
          className={`${option} disabled:opacity-40 disabled:hover:bg-transparent`}
        >
          <span className="flex-1">Стереть дневник</span>
          <small className="font-bold text-[12.5px] text-fg-faint tabular-nums">{count}</small>
        </button>
      )}
    </Panel>
  );
}

/** The city the light and the dark are worked out for, or the time zone's. */
export function PlaceMenu({
  anchor,
  settings,
  onClose,
}: {
  anchor: HTMLElement;
  settings: DiarySettings;
  onClose: () => void;
}) {
  const choose = useChooseCity();
  const [query, setQuery] = useState("");
  const listId = useId();
  const found = citiesMatching(query);
  const pick = (city: DiaryCity | null) => {
    const same = city ? settings.city?.name === city.name : settings.city === null;
    if (!same) choose.mutate(city);
    onClose();
  };
  const zone = settings.zone ? zoneCityName(settings.zone.zone) : null;

  return (
    <Panel anchor={anchor} label="Где ты" onClose={onClose}>
      <PanelTitle>Где ты</PanelTitle>
      <PanelText>
        По городу считается, когда светло и когда темно, — без интернета. Хватает города, точный
        адрес не нужен.
      </PanelText>
      <label className="mx-1 mb-1.5 flex h-[38px] shrink-0 items-center gap-2 rounded-[19px] bg-white/[0.07] px-3 text-fg-muted focus-within:bg-white/10">
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <input
          // biome-ignore lint/a11y/noAutofocus: the panel opens to choose a city, and typing one is quickest
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              document.getElementById(listId)?.querySelector<HTMLElement>("[data-option]")?.focus();
            }
            if (event.key === "Enter" && found[0]) pick(found[0]);
          }}
          placeholder="Город"
          aria-label="Найти город"
          aria-controls={listId}
          className="h-full min-w-0 flex-1 bg-transparent font-semibold text-fg outline-none placeholder:text-fg-muted"
        />
      </label>
      <div
        id={listId}
        role="menu"
        aria-label="Город"
        onKeyDown={moveWithArrows}
        className="min-h-20 flex-1 overflow-y-auto"
      >
        {!query.trim() && (
          <button
            type="button"
            role="menuitemradio"
            data-option
            aria-checked={settings.city === null}
            onClick={() => pick(null)}
            className={option}
          >
            <span className="flex-1">По часовому поясу</span>
            {zone && <small className="font-bold text-[12.5px] text-fg-faint">{zone}</small>}
            {settings.city === null && (
              <Check className="size-[17px] text-glow-1" aria-hidden="true" />
            )}
          </button>
        )}
        {found.map((city) => {
          const on = settings.city?.name === city.name;
          return (
            <button
              key={city.name}
              type="button"
              role="menuitemradio"
              data-option
              aria-checked={on}
              onClick={() => pick(city)}
              className={option}
            >
              <span className="flex-1 truncate">{city.name}</span>
              {on && <Check className="size-[17px] text-glow-1" aria-hidden="true" />}
            </button>
          );
        })}
        {found.length === 0 && (
          <PanelText>Такого города нет в списке — выбери ближайший большой.</PanelText>
        )}
      </div>
      <p className="shrink-0 px-2.5 pt-2 pb-1.5 font-bold text-[12px] text-fg-faint leading-[1.45]">
        Город влияет на новые записи; уже записанные остаются как были.
      </p>
    </Panel>
  );
}
