import { Link, ListStart, type LucideIcon, Radio, UserRound } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { trackStation } from "@/api/player";
import type { Track } from "@/api/types";
import { useOpener } from "@/features/library/nav";
import { playInOrder } from "@/features/library/play";
import { type QueueSource, usePlayer } from "@/features/player/store";
import { actionFailed, requestFailed, requestSucceeded } from "@/features/problems/watch";
import { actionWords } from "@/features/problems/words";

const WIDTH = 240;
/** The menu's height with its four items, to decide whether it opens up or down. */
const HEIGHT = 190;

function Item({
  icon: Icon,
  onClick,
  disabled = false,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left font-bold text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg focus-visible:bg-white/[0.06] focus-visible:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {children}
    </button>
  );
}

/** A station from one track, started with it; the menu may be gone by the time it arrives. */
async function playRadio(track: Track) {
  try {
    const tracks = await trackStation(track.id);
    requestSucceeded();
    playInOrder([track, ...tracks.filter((t) => t.id !== track.id)], {
      kind: "station",
      title: track.title,
    });
  } catch (error) {
    requestFailed(error);
    actionFailed(
      "track-radio",
      actionWords(
        "Радио по треку не включилось",
        `Радио по «${track.title}» не загрузилось.`,
        error,
      ),
      error,
    );
  }
}

/**
 * What can be done with one track, from its «…» button: play it next, its
 * radio, its artist, its link. Floats over the page and closes on Escape, a
 * click elsewhere or any scroll.
 */
export function TrackMenu({
  track,
  anchor,
  source,
  onClose,
}: {
  track: Track;
  /** The «…» button it opens from. */
  anchor: HTMLElement;
  source: QueueSource;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const open = useOpener();
  const say = usePlayer((s) => s.say);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      // The «…» button toggles the menu itself.
      if (!box.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        anchor.focus();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onClose, true);
    box.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [anchor, onClose]);

  const rect = anchor.getBoundingClientRect();
  const left = Math.min(window.innerWidth - WIDTH - 12, Math.max(12, rect.right - WIDTH));
  // Below the button when it fits above the player bar, otherwise above it.
  const style =
    rect.bottom + 8 + HEIGHT < window.innerHeight - 84
      ? { left, top: rect.bottom + 8 }
      : { left, bottom: window.innerHeight - rect.top + 8 };

  const artist = track.user;
  const done = (then: () => void) => () => {
    then();
    onClose();
  };

  return createPortal(
    <div
      ref={box}
      role="menu"
      aria-label={`Действия с треком ${track.title}`}
      style={{ ...style, width: WIDTH }}
      className="fixed z-50 rounded-2xl border border-line bg-panel p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]"
    >
      <Item icon={ListStart} onClick={done(() => usePlayer.getState().playNext(track, source))}>
        Играть следующим
      </Item>
      <Item icon={Radio} onClick={done(() => void playRadio(track))}>
        Радио по треку
      </Item>
      <Item
        icon={UserRound}
        disabled={!artist}
        onClick={done(() => {
          if (artist) open.artist(artist);
        })}
      >
        Перейти к артисту
      </Item>
      <Item
        icon={Link}
        disabled={!track.permalinkUrl}
        onClick={done(() => {
          if (!track.permalinkUrl) return;
          navigator.clipboard.writeText(track.permalinkUrl).then(
            () => say("Ссылка на трек скопирована"),
            () => say("Не получилось скопировать ссылку"),
          );
        })}
      >
        Скопировать ссылку
      </Item>
    </div>,
    document.body,
  );
}
