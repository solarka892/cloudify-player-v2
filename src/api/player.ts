import { call } from "@/api/invoke";
import type { Stream, Track, Waveform } from "@/api/types";

/** Something playable for a track, as the signed-in user. Resolve right before playing. */
export function stream(trackId: number): Promise<Stream> {
  return call<Stream>("stream", { trackId });
}

/** The loudness outline behind `track.waveformUrl`. */
export function waveform(url: string): Promise<Waveform> {
  return call<Waveform>("waveform", { url });
}

/** SoundCloud's radio from a track: about fifty tracks like it. */
export function trackStation(trackId: number): Promise<Track[]> {
  return call<Track[]>("track_station", { trackId });
}
