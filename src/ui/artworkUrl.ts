// SoundCloud image URLs end in a size token (`…-large.jpg` is 100×100); the
// same picture at another size is the same URL with another token. Mirrors
// `soundcloud::artwork_url` on the Rust side.

const TOKENS = { 100: "large", 300: "t300x300", 500: "t500x500" } as const;

export type ArtworkSize = keyof typeof TOKENS;

const SIZE_TOKEN = /-(large|original|crop|small|tiny|mini|badge|t\d+x\d+)(\.[a-z0-9]+)(?=$|[?#])/i;

/** The same artwork at `size` px; URLs without a size token come back unchanged. */
export function artworkUrl(url: string, size: ArtworkSize): string {
  return url.replace(SIZE_TOKEN, `-${TOKENS[size]}$2`);
}
