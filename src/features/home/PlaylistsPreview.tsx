import { useMutation } from "@tanstack/react-query";
import { playlist as fetchPlaylist } from "@/api/library";
import type { Playlist } from "@/api/types";
import { SectionHeader, SectionProblem } from "@/features/home/SectionHeader";
import { usePlaylists } from "@/features/library/queries";
import { usePlayer } from "@/features/player/store";
import { Held } from "@/features/problems/Held";
import { actionFailed } from "@/features/problems/watch";
import { actionWords } from "@/features/problems/words";
import { canPlay } from "@/features/selection/buildQueue";
import { formatCount, plural } from "@/ui/format";
import { Mosaic } from "@/ui/Mosaic";

const SHOWN = 2;

/** «Плейлисты»: your own, as mosaics of their first covers; a click plays it from the top. */
export function PlaylistsPreview({
  count,
  onAll,
  className = "",
}: {
  count: number | null;
  onAll: () => void;
  className?: string;
}) {
  const playlists = usePlaylists();
  const say = usePlayer((s) => s.say);
  const open = useMutation({
    mutationFn: (item: Playlist) => fetchPlaylist(item.id),
    onSuccess: (full) => {
      const tracks = (full.tracks ?? []).filter(canPlay);
      if (tracks.length === 0) say(`В «${full.title}» нет треков, которые здесь играют`);
      else usePlayer.getState().playQueue(tracks, 0, { kind: "playlist", title: full.title });
    },
    onError: (error, item) =>
      actionFailed(
        "play-playlist",
        actionWords("Плейлист не включился", `«${item.title}» не загрузился.`, error),
        error,
      ),
  });
  const items = playlists.data?.items ?? [];

  return (
    <section aria-labelledby="playlists-title" className={className}>
      <SectionHeader
        id="playlists-title"
        title="Плейлисты"
        count={count !== null ? formatCount(count) : null}
        onAll={onAll}
      />
      {playlists.isError ? (
        <Held error={playlists.error} frames={<PlaylistsSkeleton />} />
      ) : playlists.isPending ? (
        <PlaylistsSkeleton />
      ) : items.length === 0 ? (
        <SectionProblem text="Своих плейлистов пока нет. Собери первый на SoundCloud — он появится здесь." />
      ) : (
        <div className="mt-[18px] grid grid-cols-2 gap-3.5">
          {items.slice(0, SHOWN).map((item) => {
            const busy = open.isPending && open.variables?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => open.mutate(item)}
                aria-busy={busy}
                className="min-w-0 rounded-[18px] bg-panel p-2.5 text-left transition-colors duration-150 hover:bg-panel-hover aria-busy:opacity-60"
              >
                <Mosaic playlist={item} className="w-full rounded-xl" />
                <b className="mt-2 block truncate font-extrabold text-[14px]">{item.title}</b>
                <span className="font-bold text-[12.5px] text-fg-faint">
                  {item.trackCount} {plural(item.trackCount, ["трек", "трека", "треков"])}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PlaylistsSkeleton() {
  return (
    <div aria-hidden="true" className="mt-[18px] grid grid-cols-2 gap-3.5">
      <div className="aspect-[0.8] rounded-[18px] bg-panel" />
      <div className="aspect-[0.8] rounded-[18px] bg-panel" />
    </div>
  );
}
