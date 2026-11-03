import { Music2 } from "lucide-react";
import { useState } from "react";
import { type ArtworkSize, artworkUrl } from "@/ui/artworkUrl";

interface ArtworkProps {
  url: string | null;
  /** The CDN size to ask for: about twice the rendered size, for sharp screens. */
  size: ArtworkSize;
  className?: string;
  eager?: boolean;
}

/** A cover or avatar. Without one — or when it fails to load — a quiet tile, never a broken image. */
export function Artwork({ url, size, className = "", eager = false }: ArtworkProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) {
    return (
      <div className={`grid place-content-center bg-panel-hover text-fg-faint ${className}`}>
        <Music2 className="size-[40%] max-h-8 max-w-8" strokeWidth={1.6} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={artworkUrl(url, size)}
      alt=""
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(url)}
      className={`bg-panel-hover object-cover ${className}`}
    />
  );
}
