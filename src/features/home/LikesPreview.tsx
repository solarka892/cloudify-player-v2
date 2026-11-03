import { isRetryable } from "@/api/invoke";
import type { Track } from "@/api/types";
import { SectionHeader, SectionProblem } from "@/features/home/SectionHeader";
import { useLikes } from "@/features/library/queries";
import { currentTrack, usePlayer } from "@/features/player/store";
import { canPlay } from "@/features/selection/buildQueue";
import { Artwork } from "@/ui/Artwork";
import { describeError } from "@/ui/errors";
import { formatCount, formatDuration } from "@/ui/format";

const SHOWN = 5;
const SKELETON = ["a", "b", "c", "d", "e"];

/** Why a track won't play in full, said before anyone presses play. */
function badge(track: Track): string | null {
  if (track.access.policy === "block") return "не в твоём регионе";
  if (!track.access.playable) return "не играет здесь";
  if (track.access.preview) return "Go+ · 30 с";
  return null;
}

/** «Лайки»: the latest five, each ready to play with the rest of the likes after it. */
export function LikesPreview({
  count,
  onAll,
  className = "",
}: {
  count: number | null;
  onAll: () => void;
  className?: string;
}) {
  const likes = useLikes();
  const nowId = usePlayer((s) => currentTrack(s)?.id ?? null);
  const tracks = likes.data?.items.map((item) => item.track) ?? [];

  const play = (track: Track) => {
    const playable = tracks.filter(canPlay);
    const index = playable.findIndex((t) => t.id === track.id);
    if (index >= 0) usePlayer.getState().playQueue(playable, index, { kind: "likes" });
  };

  return (
    <section aria-labelledby="likes-title" className={className}>
      <SectionHeader
        id="likes-title"
        title="Лайки"
        count={count !== null ? formatCount(count) : null}
        onAll={onAll}
      />
      {likes.isError ? (
        <SectionProblem
          text={describeError(likes.error)}
          {...(isRetryable(likes.error) ? { onRetry: () => void likes.refetch() } : {})}
        />
      ) : likes.isPending ? (
        <ul aria-hidden="true" className="mt-3">
          {SKELETON.map((key) => (
            <li key={key} className="flex h-[50px] items-center gap-3.5">
              <span className="size-11 rounded-[9px] bg-panel" />
              <span className="h-3 w-1/2 rounded bg-panel" />
            </li>
          ))}
        </ul>
      ) : tracks.length === 0 ? (
        <SectionProblem text="Пока нет лайков. Поставь сердечко треку на SoundCloud — он появится здесь." />
      ) : (
        <ul className="mt-3">
          {tracks.slice(0, SHOWN).map((track) => {
            const note = badge(track);
            const off = !canPlay(track);
            const isNow = track.id === nowId;
            return (
              <li key={track.id}>
                <button
                  type="button"
                  disabled={off}
                  onClick={() => play(track)}
                  className="-mx-2 grid h-[50px] w-[calc(100%+16px)] grid-cols-[44px_minmax(0,1fr)_auto_46px] items-center gap-3.5 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-white/5 disabled:hover:bg-transparent"
                >
                  <Artwork
                    url={track.artworkUrl}
                    size={100}
                    className={`size-11 rounded-[9px] ${off ? "opacity-40" : ""}`}
                  />
                  <span className={`min-w-0 ${off ? "opacity-40" : ""}`}>
                    <b
                      className={`block truncate font-extrabold text-[14.5px] ${isNow ? "text-glow-1" : ""}`}
                    >
                      {track.title}
                    </b>
                    <span className="block truncate font-bold text-[13px] text-fg-muted">
                      {track.user?.username}
                    </span>
                  </span>
                  <span>
                    {note && (
                      <span className="whitespace-nowrap rounded-lg bg-white/[0.07] px-2 py-1 font-extrabold text-[11px] text-fg-muted leading-none">
                        {note}
                      </span>
                    )}
                  </span>
                  <span className="text-right font-bold text-fg-faint tabular-nums">
                    {formatDuration(track.fullDurationMs)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
