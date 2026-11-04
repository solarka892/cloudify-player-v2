import type { Me } from "@/api/types";
import { Hero } from "@/features/home/Hero";
import { LikesPreview } from "@/features/home/LikesPreview";
import { PlaylistsPreview } from "@/features/home/PlaylistsPreview";
import { ResumeCard } from "@/features/home/ResumeCard";
import type { SectionId } from "@/features/library/nav";
import { Part } from "@/features/problems/Part";

/** A home section's shape while it cannot show itself. */
function Frame() {
  return <div className="mt-[34px] h-[250px] rounded-[18px] bg-panel" />;
}

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
      <Part name={{ name: "Подборка", form: "f" }} frames={<div className="h-[560px] bg-ground" />}>
        <Hero me={me} />
      </Part>
      <div className="home-grid px-14 pt-5 pb-8">
        <div className="[grid-area:resume]">
          <Part name={{ name: "«Продолжить»", form: "n" }} frames={<Frame />}>
            <ResumeCard />
          </Part>
        </div>
        <div className="[grid-area:likes]">
          <Part name={{ name: "Лайки", form: "pl" }} frames={<Frame />}>
            <LikesPreview count={me.user.likesCount} onAll={() => onOpenLibrary("likes")} />
          </Part>
        </div>
        <div className="[grid-area:pls]">
          <Part name={{ name: "Плейлисты", form: "pl" }} frames={<Frame />}>
            <PlaylistsPreview
              count={me.user.playlistCount}
              onAll={() => onOpenLibrary("playlists")}
            />
          </Part>
        </div>
      </div>
    </>
  );
}
