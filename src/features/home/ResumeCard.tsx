import { useState } from "react";
import { SectionHeader } from "@/features/home/SectionHeader";
import { useHistory } from "@/features/library/queries";
import { loadResumePoint } from "@/features/player/resume";
import { currentTrack, usePlayer } from "@/features/player/store";
import { Artwork } from "@/ui/Artwork";
import { formatSeconds, relativeDay } from "@/ui/format";

/**
 * «Продолжить»: the track you stopped on, from where you stopped. Cloudify's
 * own resume point comes first (it knows the second); otherwise the last thing
 * SoundCloud says you played (it knows only the day).
 */
export function ResumeCard({ className = "" }: { className?: string }) {
  const history = useHistory();
  const loaded = usePlayer(currentTrack);
  const playing = usePlayer((s) => s.playing);
  const position = usePlayer((s) => s.position);
  // Where the previous session stopped, read once: what plays now is the player's business.
  const [point] = useState(loadResumePoint);
  const last = history.data?.items[0];

  const track = point?.track ?? last?.track ?? null;
  const isLoaded = track !== null && loaded?.id === track.id;
  const at = isLoaded ? position : (point?.position ?? 0);
  const length = track ? track.durationMs / 1000 : 0;

  let when = "";
  if (point && track?.id === point.track.id) {
    const day = point.savedAt ? relativeDay(point.savedAt) : "";
    when = `Остановился ${day ? `${day} ` : ""}на ${formatSeconds(at)}`;
  } else if (last?.playedAt) {
    when = `Слушал ${relativeDay(last.playedAt)}`;
  }

  const resume = () => {
    if (!track) return;
    const player = usePlayer.getState();
    if (isLoaded) player.toggle();
    else player.playQueue([track], 0, { kind: "history" }, { startAt: point?.position ?? 0 });
  };

  return (
    <section aria-labelledby="resume-title" className={className}>
      <SectionHeader id="resume-title" title="Продолжить" />
      {track ? (
        <button
          type="button"
          onClick={resume}
          aria-label={`${isLoaded && playing ? "Пауза" : "Продолжить"}: ${track.title}`}
          className="group mt-[18px] grid w-full grid-cols-[104px_minmax(0,1fr)] items-center gap-4 rounded-[22px] bg-panel p-4 text-left transition-colors duration-150 hover:bg-panel-hover"
        >
          <Artwork url={track.artworkUrl} size={300} className="size-[104px] rounded-[14px]" />
          <span className="min-w-0">
            <b className="line-clamp-2 font-extrabold text-[16.5px] leading-[1.25]">
              {track.title}
            </b>
            <span className="block truncate font-bold text-fg-muted">{track.user?.username}</span>
            {when && (
              <small className="mt-2.5 block font-bold text-[12.5px] text-fg-faint tabular-nums">
                {when}
              </small>
            )}
          </span>
          {at > 0 && length > 0 && (
            <span aria-hidden="true" className="relative col-span-2 h-1 rounded-sm bg-white/10">
              <span
                className="absolute inset-y-0 left-0 rounded-sm bg-linear-to-r from-glow-2 to-glow-1"
                style={{ width: `${Math.min(100, (at / length) * 100)}%` }}
              />
            </span>
          )}
        </button>
      ) : (
        <div className="mt-[18px] grid min-h-[136px] place-content-center rounded-[22px] bg-panel p-6 text-center text-[13.5px] text-fg-muted">
          {history.isPending ? "" : "Здесь будет трек, на котором ты остановился."}
        </div>
      )}
    </section>
  );
}
