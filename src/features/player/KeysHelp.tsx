import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, type LucideIcon, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type Cap,
  KEY_GROUPS,
  type KeyId,
  type KeyLine,
  keyOf,
  onMac,
} from "@/features/player/hotkeys";
import { usePanels } from "@/features/player/panels";

// The key help: a keyboard drawn above the player, every key that does
// something lit in the playing cover's colour. Point at a key or press it and
// it says what it does — and a press really does it: this is the player, not
// a drill.

interface Key {
  label: string;
  code?: string;
  /** In key widths; one by default. */
  width?: number;
}

const DIGITS = "1234567890".split("");
const letters = (row: string): Key[] => row.split("").map((l) => ({ label: l, code: `Key${l}` }));

const ROWS: readonly (readonly Key[])[] = [
  [
    { label: "esc", code: "Escape" },
    ...DIGITS.map((d) => ({ label: d, code: `Digit${d}` })),
    { label: "-" },
    { label: "=" },
    { label: onMac ? "delete" : "backspace", code: "Backspace", width: 1.6 },
  ],
  [
    { label: "tab", width: 1.6 },
    ...letters("QWERTYUIOP"),
    { label: "[" },
    { label: "]" },
    { label: "\\" },
  ],
  [
    { label: "caps", width: 1.9 },
    ...letters("ASDFGHJKL"),
    { label: ";" },
    { label: "'" },
    { label: onMac ? "return" : "enter", code: "Enter", width: 1.7 },
  ],
  [
    { label: "shift", code: "ShiftLeft", width: 2.4 },
    ...letters("ZXCVBNM"),
    { label: "," },
    { label: "." },
    { label: "?", code: "Slash" },
    { label: "shift", code: "ShiftRight", width: 2.4 },
  ],
  onMac
    ? [
        { label: "fn" },
        { label: "⌃" },
        { label: "⌥", code: "AltLeft", width: 1.2 },
        { label: "⌘", code: "MetaLeft", width: 1.4 },
        { label: "пробел", code: "Space", width: 5.2 },
        { label: "⌘", code: "MetaRight", width: 1.4 },
        { label: "⌥", code: "AltRight", width: 1.2 },
      ]
    : [
        { label: "ctrl", code: "ControlLeft", width: 1.4 },
        { label: "win", width: 1.2 },
        { label: "alt", code: "AltLeft", width: 1.2 },
        { label: "пробел", code: "Space", width: 5.4 },
        { label: "alt", code: "AltRight", width: 1.2 },
        { label: "ctrl", code: "ControlRight", width: 1.4 },
      ],
];

/** The arrow block, an upside-down T at the end of the bottom row. */
const ARROW_KEYS = [
  { code: "ArrowUp", icon: ArrowUp, place: "col-start-2 row-start-1" },
  { code: "ArrowLeft", icon: ArrowLeft, place: "col-start-1 row-start-2" },
  { code: "ArrowDown", icon: ArrowDown, place: "col-start-2 row-start-2" },
  { code: "ArrowRight", icon: ArrowRight, place: "col-start-3 row-start-2" },
] as const;

const MODS = onMac ? ["MetaLeft", "MetaRight"] : ["ControlLeft", "ControlRight"];
const SHIFTS = ["ShiftLeft", "ShiftRight"];

/** The keys each line of the map needs, lit together when the line is pointed at. */
const CODES: Record<KeyId, readonly string[]> = {
  play: ["Space"],
  seek: ["ArrowLeft", "ArrowRight"],
  skip: [...SHIFTS, "ArrowLeft", "ArrowRight"],
  jump: DIGITS.map((d) => `Digit${d}`),
  volume: ["ArrowUp", "ArrowDown"],
  mute: ["KeyM"],
  queue: ["KeyQ"],
  shuffle: ["KeyS"],
  repeat: ["KeyR"],
  pick: ["Enter"],
  drop: ["Backspace"],
  move: ["AltLeft", "AltRight", "ArrowUp", "ArrowDown"],
  search: [...MODS, "KeyK"],
  find: [...MODS, "KeyF"],
  help: [...SHIFTS, "Slash"],
  close: ["Escape"],
};
const LINES: readonly KeyLine[] = KEY_GROUPS.flatMap((group) => group.lines);
const USED = new Set(Object.values(CODES).flat());
/** The lines a key takes part in. */
const linesOf = (code: string): KeyId[] =>
  LINES.filter((line) => CODES[line.id].includes(code)).map((line) => line.id);

const ARROWS: Record<string, { icon: LucideIcon; name: string }> = {
  left: { icon: ArrowLeft, name: "стрелка влево" },
  right: { icon: ArrowRight, name: "стрелка вправо" },
  up: { icon: ArrowUp, name: "стрелка вверх" },
  down: { icon: ArrowDown, name: "стрелка вниз" },
};

/** Keycaps for a line of the map: «Shift ← →», «⌘ K», «0 … 9». */
export function Keys({ caps, small = false }: { caps: readonly Cap[]; small?: boolean }) {
  const size = small
    ? "h-[22px] min-w-[22px] px-1.5 text-[11px]"
    : "h-[26px] min-w-[26px] px-[7px] text-[12px]";
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {/* A line never names one key twice, so a cap is its own key. */}
      {caps.map((cap) => {
        if (cap === "…")
          return (
            <span key={cap} className="font-bold text-fg-faint">
              …
            </span>
          );
        const arrow = ARROWS[cap];
        return (
          <kbd
            key={cap}
            aria-label={arrow?.name}
            className={`inline-grid place-content-center whitespace-nowrap rounded-[7px] bg-white/[0.07] font-extrabold font-sans text-fg shadow-[inset_0_-1px_0_rgb(255_255_255/0.06)] ${size}`}
          >
            {arrow ? <arrow.icon className="size-3.5" strokeWidth={2.4} aria-hidden="true" /> : cap}
          </kbd>
        );
      })}
    </span>
  );
}

export function KeysHelp() {
  const open = usePanels((s) => s.keys);
  return open ? <KeysSheet /> : null;
}

function KeysSheet() {
  const box = useRef<HTMLElement>(null);
  const [said, setSaid] = useState<readonly KeyId[]>([]);
  const [hot, setHot] = useState<ReadonlySet<string>>(new Set());
  const [down, setDown] = useState<string | null>(null);
  const close = () => usePanels.getState().showKeys(false);

  const point = (ids: readonly KeyId[], codes: Iterable<string>) => {
    setSaid(ids);
    setHot(new Set(codes));
  };

  // A real press lights its key and says what it did; the hotkey itself runs as usual.
  useEffect(() => {
    let timer = 0;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const id = keyOf(event);
      if (id) {
        setSaid([id]);
        setHot(new Set(CODES[id]));
      }
      setDown(event.code);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDown(null), 220);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, []);

  // Outside presses close it; the player bar under it does not count.
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || box.current?.contains(target)) return;
      if (target.closest("[data-player-bar]")) return;
      usePanels.getState().showKeys(false);
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, []);

  // The sheet itself takes the focus — not its button, so space still plays — and gives it back.
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
      data-keys-help
      role="dialog"
      aria-labelledby="keys-title"
      tabIndex={-1}
      className="sheet-up fixed inset-x-0 bottom-[84px] z-[45] grid grid-cols-[auto_minmax(0,1fr)] items-start gap-9 rounded-t-[22px] border border-line border-b-0 bg-panel px-8 py-[22px] shadow-[0_-24px_60px_-20px_rgb(0_0_0/0.8)] outline-none"
    >
      <div aria-hidden="true" className="grid gap-1" onPointerLeave={() => point([], [])}>
        {ROWS.map((row, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the keyboard's rows are fixed
          <div key={r} className="flex items-start gap-1">
            {row.map((key, k) => (
              <KeyCap
                // biome-ignore lint/suspicious/noArrayIndexKey: the keyboard's keys are fixed
                key={k}
                label={key.label}
                width={key.width ?? 1}
                used={key.code !== undefined && USED.has(key.code)}
                hot={key.code !== undefined && hot.has(key.code)}
                down={key.code !== undefined && key.code === down}
                onPoint={() => key.code && point(linesOf(key.code), [key.code])}
              />
            ))}
            {r === ROWS.length - 1 && (
              <div className="ml-2.5 grid grid-cols-[repeat(3,34px)] grid-rows-[repeat(2,25px)] gap-1">
                {ARROW_KEYS.map(({ code, icon: Icon, place }) => (
                  <KeyCap
                    key={code}
                    label={<Icon className="size-3.5" strokeWidth={2.4} />}
                    used
                    tall={false}
                    hot={hot.has(code)}
                    down={down === code}
                    onPoint={() => point(linesOf(code), [code])}
                    className={place}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="min-w-0">
        <header className="flex items-center gap-3">
          <h2
            id="keys-title"
            className="flex-1 font-bold font-display text-[19px] leading-none tracking-[-0.02em]"
          >
            Клавиши
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            title="Закрыть (Esc или ?)"
            className="grid size-8 place-content-center rounded-full text-fg-muted transition-colors hover:bg-white/[0.08] hover:text-fg"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div
          aria-live="polite"
          className="mt-3.5 flex min-h-[62px] flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] bg-white/5 px-3.5 py-3"
        >
          {said.length > 0 ? (
            said.map((id) => {
              const line = LINES.find((l) => l.id === id);
              return (
                line && (
                  <span key={id} className="flex min-w-0 items-center gap-3">
                    <Keys caps={line.caps} />
                    <b className="font-extrabold text-[15.5px]">{line.label}</b>
                  </span>
                )
              );
            })
          ) : (
            <span>
              <b className="block font-extrabold text-[15.5px]">
                Наведи на светлую клавишу или нажми её
              </b>
              <small className="mt-0.5 block font-bold text-[12.5px] text-fg-faint">
                Нажатая клавиша сразу сработает: это настоящий плеер, а не тренажёр.
              </small>
            </span>
          )}
        </div>
        <ul className="mt-3 columns-1 gap-6 min-[1100px]:columns-2">
          {LINES.map((line) => (
            <li
              key={line.id}
              onPointerEnter={() => point([line.id], CODES[line.id])}
              onPointerLeave={() => point([], [])}
              className={`-mx-1.5 flex min-h-[30px] break-inside-avoid items-center justify-between gap-2.5 rounded-lg px-1.5 text-[13px] transition-colors ${
                said.includes(line.id) ? "bg-white/[0.06] text-fg" : "text-fg-muted"
              }`}
            >
              <span>{line.label}</span>
              <Keys caps={line.caps} small />
            </li>
          ))}
        </ul>
        <p className="mt-3 font-bold text-[12.5px] text-fg-faint">
          Пока печатаешь в поле, клавиши молчат. Раскладка не важна: и в русской всё работает.
        </p>
      </div>
    </section>
  );
}

function KeyCap({
  label,
  width = 1,
  used,
  hot,
  down,
  tall = true,
  className = "",
  onPoint,
}: {
  label: ReactNode;
  width?: number;
  used: boolean;
  hot: boolean;
  down: boolean;
  tall?: boolean;
  className?: string;
  onPoint: () => void;
}) {
  const look = hot
    ? "bg-glow-1 text-ink"
    : used
      ? "bg-white/10 text-fg shadow-[inset_0_-2px_0_color-mix(in_srgb,var(--glow-1)_70%,transparent)]"
      : "bg-white/[0.035] text-white/20";
  return (
    <span
      onPointerEnter={used ? onPoint : undefined}
      className={`grid place-content-center rounded-[7px] font-bold text-[11.5px] leading-none transition-[background-color,color,transform] duration-150 ${look} ${down ? "translate-y-px scale-[0.96]" : ""} ${used ? "cursor-pointer" : ""} ${className}`}
      style={{
        width: `calc(34px * ${width} + 4px * ${width - 1})`,
        height: tall ? 34 : "100%",
      }}
    >
      {label}
    </span>
  );
}
