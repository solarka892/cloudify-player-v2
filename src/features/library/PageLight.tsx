import type { CSSProperties } from "react";
import { usePointedCover } from "@/features/library/light";
import { useCoverColours } from "@/features/player/coverGlow";
import { currentTrack, usePlayer } from "@/features/player/store";
import { useLoudness } from "@/features/player/useLoudness";
import { Ribbon } from "@/ui/Ribbon";

/**
 * The light over a page of covers (the library, search). It swells with the
 * playing track like the home screen's; its colours are the cover you point
 * at, else the page's own `cover` (an opened playlist, a found artist), else
 * the playing cover's, crossing over as they change.
 */
export function PageLight({ cover }: { cover: string | null }) {
  const pointed = usePointedCover((s) => s.cover);
  const colours = useCoverColours(pointed ?? cover);
  const nowPlaying = usePlayer(currentTrack);
  const playing = usePlayer((s) => s.playing);
  const loudness = useLoudness(nowPlaying);
  const relit = colours
    ? ({
        "--glow-1": colours[0],
        "--glow-2": colours[1],
        "--glow-3": colours[2],
      } as CSSProperties)
    : undefined;

  return (
    <div
      aria-hidden="true"
      className={`grain pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-clip ${pointed ? "relight-quick" : "relight"}`}
      style={relit}
    >
      <Ribbon
        playing={playing && nowPlaying !== null}
        energy={0.85}
        pace={0.75}
        loudness={loudness}
        className="absolute inset-x-0 top-6 h-[420px] w-full"
      />
    </div>
  );
}
