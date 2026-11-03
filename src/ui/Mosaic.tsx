import type { Playlist } from "@/api/types";
import { Artwork } from "@/ui/Artwork";
import type { ArtworkSize } from "@/ui/artworkUrl";

interface FaceProps {
  /** The CDN size each cover is asked for. */
  coverSize?: ArtworkSize;
  className?: string;
}

/**
 * Four covers in one square, or the single `fallback` picture when there are
 * fewer. Sizes come from `className` (round the corners there).
 */
export function CoverMosaic({
  covers,
  fallback,
  coverSize = 300,
  className = "",
}: FaceProps & { covers: readonly string[]; fallback: string | null }) {
  const four = covers.length >= 4 ? covers.slice(0, 4) : null;
  if (!four) {
    return (
      <Artwork
        url={fallback ?? covers[0] ?? null}
        size={coverSize}
        className={`aspect-square ${className}`}
      />
    );
  }
  return (
    <span className={`grid aspect-square grid-cols-2 overflow-hidden ${className}`}>
      {four.map((url, i) => (
        // Two tracks can share a cover; the slot is what is unique.
        // biome-ignore lint/suspicious/noArrayIndexKey: four fixed slots that never reorder
        <Artwork key={i} url={url} size={coverSize} className="size-full" />
      ))}
    </span>
  );
}

/** A playlist's face: the covers of its first four tracks, or its own artwork. */
export function Mosaic({ playlist, ...face }: FaceProps & { playlist: Playlist }) {
  return <CoverMosaic covers={playlist.covers} fallback={playlist.artworkUrl} {...face} />;
}

/** The latest distinct covers of a list, for a section's own mosaic. */
export function latestCovers(
  tracks: readonly { artworkUrl: string | null }[],
  count = 4,
): string[] {
  const covers: string[] = [];
  for (const track of tracks) {
    if (track.artworkUrl && !covers.includes(track.artworkUrl)) covers.push(track.artworkUrl);
    if (covers.length === count) break;
  }
  return covers;
}
