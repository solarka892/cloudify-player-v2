import { useQuery } from "@tanstack/react-query";
import { waveform } from "@/api/player";
import type { Track, Waveform } from "@/api/types";

const POINTS = 240;

/**
 * A waveform as 0…1 loudness at `POINTS` even steps. Stretched between the
 * quietest 5% and the loudest sample, so heavily mastered tracks (which sit
 * near the top all the way through) still show their shape.
 */
export function normalizeWaveform({ samples }: Pick<Waveform, "samples">): number[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const high = sorted[sorted.length - 1] ?? 1;
  const span = high - low || 1;
  return Array.from({ length: POINTS }, (_, i) => {
    const from = Math.floor((i / POINTS) * samples.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / POINTS) * samples.length));
    let peak = 0;
    for (let j = from; j < to; j++) peak = Math.max(peak, samples[j] ?? 0);
    return Math.min(1, Math.max(0, (peak - low) / span));
  });
}

/** The track's loudness outline, or `null` while it loads (or when SoundCloud has none). */
export function useLoudness(track: Track | null): number[] | null {
  const url = track?.waveformUrl ?? null;
  const query = useQuery({
    queryKey: ["waveform", url],
    queryFn: async () => normalizeWaveform(await waveform(url ?? "")),
    enabled: url !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return query.data ?? null;
}
