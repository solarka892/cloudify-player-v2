import { useEffect } from "react";
import { usePanels } from "@/features/player/panels";
import { usePlayer } from "@/features/player/store";

// The window's hotkeys and the map the help draws them from. Keys are read by
// their place on the keyboard (`code`), not by the letter they type, so they
// work the same in the Russian layout.

/** What a line of the key map does. */
export type KeyId =
  | "play"
  | "seek"
  | "skip"
  | "jump"
  | "volume"
  | "mute"
  | "queue"
  | "shuffle"
  | "repeat"
  | "pick"
  | "drop"
  | "move"
  | "search"
  | "find"
  | "help"
  | "close";

/** A key as the help draws it: arrows by direction, «…» between a range, the rest by label. */
export type Cap = "left" | "right" | "up" | "down" | "…" | (string & {});

export interface KeyLine {
  id: KeyId;
  caps: readonly Cap[];
  label: string;
}

export const onMac = /Mac/.test(navigator.userAgent);
const MOD = onMac ? "⌘" : "Ctrl";
const ALT = onMac ? "⌥" : "Alt";

export const KEY_GROUPS: readonly { name: string; lines: readonly KeyLine[] }[] = [
  {
    name: "Плеер",
    lines: [
      { id: "play", caps: ["Пробел"], label: "Играть или пауза" },
      { id: "seek", caps: ["left", "right"], label: "Назад или вперёд на 5 секунд" },
      { id: "skip", caps: ["Shift", "left", "right"], label: "Предыдущий или следующий трек" },
      { id: "jump", caps: ["0", "…", "9"], label: "Прыжок на 0–90 % трека" },
      { id: "volume", caps: ["up", "down"], label: "Громче или тише" },
      { id: "mute", caps: ["M"], label: "Без звука" },
    ],
  },
  {
    name: "Очередь",
    lines: [
      { id: "queue", caps: ["Q"], label: "Открыть или закрыть очередь" },
      { id: "shuffle", caps: ["S"], label: "Перемешать или вернуть порядок" },
      { id: "repeat", caps: ["R"], label: "Повтор: выкл → очередь → трек" },
      { id: "pick", caps: ["Enter"], label: "В очереди: включить трек" },
      { id: "drop", caps: [onMac ? "Delete" : "Backspace"], label: "В очереди: убрать трек" },
      { id: "move", caps: [ALT, "up", "down"], label: "В очереди: передвинуть трек" },
    ],
  },
  {
    name: "Окно",
    lines: [
      { id: "search", caps: [MOD, "K"], label: "Поиск" },
      { id: "find", caps: [MOD, "F"], label: "Найти у себя в библиотеке" },
      { id: "help", caps: ["?"], label: "Эта справка" },
      { id: "close", caps: ["Esc"], label: "Закрыть" },
    ],
  },
];

/** Which line of the map a key press stands for, if any. */
export function keyOf(event: KeyboardEvent): KeyId | null {
  const { code } = event;
  if (event.metaKey || event.ctrlKey) {
    return code === "KeyK" ? "search" : code === "KeyF" ? "find" : null;
  }
  if (event.key === "?" || (code === "Slash" && event.shiftKey)) return "help";
  if (code === "Escape") return "close";
  if (event.altKey) return code === "ArrowUp" || code === "ArrowDown" ? "move" : null;
  switch (code) {
    case "Space":
      return "play";
    case "ArrowLeft":
    case "ArrowRight":
      return event.shiftKey ? "skip" : "seek";
    case "ArrowUp":
    case "ArrowDown":
      return event.shiftKey ? null : "volume";
    case "KeyM":
      return "mute";
    case "KeyQ":
      return "queue";
    case "KeyS":
      return "shuffle";
    case "KeyR":
      return "repeat";
    case "Enter":
    case "NumpadEnter":
      return "pick";
    case "Backspace":
    case "Delete":
      return "drop";
    default:
      return /^(Digit|Numpad)\d$/.test(code) && !event.shiftKey ? "jump" : null;
  }
}

const SEEK_STEP = 5;
const VOLUME_STEP = 0.05;
/** Held down, these go on repeating; the rest act once per press. */
const REPEATING = new Set<KeyId>(["seek", "volume"]);

/** Runs a line of the map; `false` when it is not this handler's to run. */
function run(id: KeyId, event: KeyboardEvent): boolean {
  const player = usePlayer.getState();
  const panels = usePanels.getState();
  switch (id) {
    case "play":
      player.toggle();
      return true;
    case "seek":
      player.seek(player.position + (event.code === "ArrowLeft" ? -SEEK_STEP : SEEK_STEP));
      return true;
    case "skip":
      if (event.code === "ArrowLeft") player.previous();
      else player.next("skip");
      return true;
    case "jump":
      player.seek((Number(event.code.slice(-1)) / 10) * player.duration);
      return true;
    case "volume":
      player.setVolume(
        (player.muted ? 0 : player.volume) +
          (event.code === "ArrowUp" ? VOLUME_STEP : -VOLUME_STEP),
      );
      return true;
    case "mute":
      player.toggleMute();
      return true;
    case "shuffle":
      player.toggleShuffle();
      return true;
    case "repeat":
      player.cycleRepeat();
      return true;
    case "queue":
      panels.showQueue();
      return true;
    case "help":
      panels.showKeys();
      return true;
    case "close":
      if (panels.keys) {
        panels.showKeys(false);
        return true;
      }
      if (panels.desk && !document.querySelector("[role='menu']")) {
        panels.showDesk(false);
        return true;
      }
      // An open menu takes this Escape for itself.
      if (panels.queue && !document.querySelector("[role='menu']")) {
        panels.showQueue(false);
        return true;
      }
      return false;
    default:
      // Search and the library's filter have their own keys; the queue's rows take theirs.
      return false;
  }
}

/**
 * The window's hotkeys, mounted once by the shell. They stay quiet while you
 * type in a field, leave a control the keys it handles itself (a slider's
 * arrows, a focused button's space), and never take Cmd or Ctrl shortcuts.
 */
export function useHotkeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const id = keyOf(event);
      if (!id || (event.repeat && !REPEATING.has(id))) return;
      // A button reached with the keyboard is pressed by its own space.
      if (id === "play" && target?.closest("button, a[href]")?.matches(":focus-visible")) return;
      if (run(id, event)) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
