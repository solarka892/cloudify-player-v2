import type { Me } from "@/api/types";
import { Hero } from "@/features/home/Hero";
import { LikesPreview } from "@/features/home/LikesPreview";
import { PlaylistsPreview } from "@/features/home/PlaylistsPreview";
import { ResumeCard } from "@/features/home/ResumeCard";
import type { SectionId } from "@/features/library/nav";

/** The home screen: the selection under its light, then your own music. */
export function HomePage({
  me,
  onOpenLibrary,
}: {
  me: Me;
  onOpenLibrary: (section: SectionId) => void;
}) {
  return (
    <>
      <Hero me={me} />
      <div className="home-grid px-14 pt-5 pb-8">
        <ResumeCard className="[grid-area:resume]" />
        <LikesPreview
          className="[grid-area:likes]"
          count={me.user.likesCount}
          onAll={() => onOpenLibrary("likes")}
        />
        <PlaylistsPreview
          className="[grid-area:pls]"
          count={me.user.playlistCount}
          onAll={() => onOpenLibrary("playlists")}
        />
      </div>
    </>
  );
}
