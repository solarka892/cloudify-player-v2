import { LoaderCircle, Play } from "lucide-react";
import type { ReactNode } from "react";
import type { Playlist, User } from "@/api/types";
import { Artwork } from "@/ui/Artwork";
import { Mosaic } from "@/ui/Mosaic";

// Tiles for things that are opened rather than played: playlists, albums,
// people, stations. The whole tile opens; a white round plays straight away.

export function TileGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-x-[18px] gap-y-5"
    >
      {children}
    </ul>
  );
}

const playRound =
  "absolute right-2 bottom-2 z-10 grid size-11 place-content-center rounded-full bg-white text-ink shadow-[0_10px_24px_-10px_rgb(0_0_0/0.8)] transition-[opacity,translate,scale] duration-150 ease-out hover:scale-105 active:scale-95 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100";

export function PlaylistTile({
  playlist,
  line,
  onOpen,
  onPlay,
  busy = false,
}: {
  playlist: Playlist;
  /** Under the title: «38 треков», «Альбом · Artist». */
  line: string;
  onOpen: () => void;
  onPlay: () => void;
  busy?: boolean;
}) {
  return (
    <li className="group relative min-w-0 rounded-[18px] bg-panel p-2.5 transition-colors duration-150 hover:bg-panel-hover">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть «${playlist.title}»`}
        className="absolute inset-0 rounded-[18px]"
      />
      {/* Clicks fall through to the tile's own button, except on the play round. */}
      <div className="pointer-events-none relative">
        <Mosaic playlist={playlist} className="w-full rounded-xl" />
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Слушать «${playlist.title}»`}
          aria-busy={busy}
          className={`${playRound} pointer-events-auto ${busy ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
          )}
        </button>
      </div>
      <b className="pointer-events-none relative mt-2.5 block truncate font-extrabold text-[14px]">
        {playlist.title}
      </b>
      <span className="pointer-events-none relative block truncate font-bold text-[12.5px] text-fg-faint">
        {line}
      </span>
    </li>
  );
}

/** Someone you follow: a round face that opens their popular tracks and radio. */
export function PersonTile({
  user,
  line,
  onOpen,
}: {
  user: User;
  line: string;
  onOpen: () => void;
}) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-[18px] p-2.5 text-center transition-colors duration-150 hover:bg-panel"
      >
        <Artwork url={user.avatarUrl} size={300} className="aspect-square w-full rounded-full" />
        <b className="mt-3 block truncate font-extrabold text-[14px]">{user.username}</b>
        <span className="block truncate font-bold text-[12.5px] text-fg-faint">{line}</span>
      </button>
    </li>
  );
}

/** A radio made from one artist: pressing it plays at once. */
export function StationTile({
  user,
  line,
  onPlay,
  busy,
}: {
  user: User;
  line: string;
  onPlay: () => void;
  busy: boolean;
}) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onPlay}
        aria-busy={busy}
        aria-label={`Включить радио ${user.username}`}
        className="group relative block w-full rounded-[18px] bg-panel p-2.5 text-left transition-colors duration-150 hover:bg-panel-hover"
      >
        <span className="relative block">
          <Artwork url={user.avatarUrl} size={300} className="aspect-square w-full rounded-xl" />

          <span
            className={`absolute right-2 bottom-2 grid size-11 place-content-center rounded-full bg-white text-ink shadow-[0_10px_24px_-10px_rgb(0_0_0/0.8)] transition-[opacity,translate] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${busy ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
          >
            {busy ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
            )}
          </span>
        </span>
        <b className="mt-2.5 block truncate font-extrabold text-[14px]">{user.username}</b>
        <span className="block truncate font-bold text-[12.5px] text-fg-faint">{line}</span>
      </button>
    </li>
  );
}

export function TileSkeleton({ count = 8, round = false }: { count?: number; round?: boolean }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-x-[18px] gap-y-5"
    >
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders with no identity
        <li key={i} className="rounded-[18px] p-2.5">
          <span
            className={`block aspect-square bg-panel ${round ? "rounded-full" : "rounded-xl"}`}
          />
          <span className="mt-3 block h-3 w-3/4 rounded bg-panel" />
          <span className="mt-2 block h-2.5 w-1/2 rounded bg-panel/70" />
        </li>
      ))}
    </ul>
  );
}
