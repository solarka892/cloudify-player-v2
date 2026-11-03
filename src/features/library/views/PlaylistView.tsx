import { Play, Shuffle } from "lucide-react";
import { useMemo, useRef } from "react";
import type { Me, Playlist } from "@/api/types";
import { CoverWall, WallSkeleton } from "@/features/library/CoverWall";
import { SECTION_NAMES, type SectionId, useOpenView } from "@/features/library/nav";
import { playInOrder, playShuffled, trackText } from "@/features/library/play";
import { usePlaylist } from "@/features/library/queries";
import {
  asideCover,
  FilterField,
  foundLine,
  NoMatch,
  primaryButton,
  roundButton,
  StageActions,
  StageHeader,
  StageNote,
} from "@/features/library/Stage";
import { useListFilter } from "@/features/library/useListFilter";
import { formatCount, formatLength, plural } from "@/ui/format";
import { Mosaic } from "@/ui/Mosaic";

const TRACKS = ["трек", "трека", "треков"] as const;

/** One playlist or album, opened: every track as a wall of covers, on its own cover's light. */
export function PlaylistView({
  me,
  playlist: known,
  from,
}: {
  me: Me;
  playlist: Playlist;
  from: SectionId;
}) {
  const open = useOpenView();
  const full = usePlaylist(known.id);
  const playlist = full.data ?? known;
  const tracks = useMemo(() => full.data?.tracks ?? [], [full.data]);
  const start = useRef<HTMLDivElement>(null);
  const { query, onQuery, shown, filtering } = useListFilter(tracks, trackText, start);
  const source = { kind: "playlist", title: playlist.title, id: playlist.id } as const;

  const kind = playlist.isAlbum ? "Альбом" : "Плейлист";
  // Someone else's playlist names its author; your own needs no name.
  const author = playlist.user && playlist.user.id !== me.user.id ? playlist.user.username : null;
  const count = playlist.trackCount;
  const lead = [
    kind,
    author,
    `${formatCount(count)} ${plural(count, TRACKS)}`,
    playlist.durationMs > 0 ? formatLength(playlist.durationMs) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <StageHeader
        title={playlist.title}
        lead={lead}
        back={{
          label: SECTION_NAMES[from],
          onClick: () => open({ kind: "section", section: from }),
        }}
        aside={<Mosaic playlist={playlist} coverSize={500} className={asideCover} />}
      />
      <StageActions>
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => playInOrder(shown, source)}
          className={primaryButton}
        >
          <Play className="size-5 fill-current stroke-none" aria-hidden="true" />
          Слушать
        </button>
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() => playShuffled(shown, source)}
          aria-label="Перемешать"
          title="Перемешать"
          className={roundButton}
        >
          <Shuffle className="size-5" aria-hidden="true" />
        </button>
        <FilterField
          value={query}
          onChange={onQuery}
          placeholder={playlist.isAlbum ? "Найти в альбоме" : "Найти в плейлисте"}
          found={foundLine(filtering, shown.length, tracks.length)}
        />
      </StageActions>
      <div ref={start} className="mt-5" />
      {full.isError ? (
        <StageNote error={full.error} onRetry={() => void full.refetch()} />
      ) : full.isPending ? (
        <WallSkeleton count={Math.min(Math.max(count, 6), 24)} />
      ) : tracks.length === 0 ? (
        <StageNote text={`В «${playlist.title}» пока нет треков, которые SoundCloud отдаёт.`} />
      ) : shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <CoverWall
          tracks={shown}
          label={playlist.title}
          named={filtering}
          onPlay={(track) => playInOrder(shown, source, track)}
        />
      )}
    </>
  );
}
