import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { likeTrack, unlikeTrack } from "@/api/library";
import type { LikedTrack, Page, Track } from "@/api/types";
import { useAllLikes } from "@/features/library/queries";
import { usePlayer } from "@/features/player/store";
import { actionFailed } from "@/features/problems/watch";
import { likeWords } from "@/features/problems/words";

const ALL_LIKES = ["library", "likes", "all"] as const;

type LikePages = InfiniteData<Page<LikedTrack>, string | null>;

/** The ids of every liked track, for hearts anywhere in the library. */
export function useLikedIds(): ReadonlySet<number> {
  const likes = useAllLikes();
  return useMemo(() => new Set(likes.items.map((like) => like.track.id)), [likes.items]);
}

function without(data: LikePages, id: number): LikePages {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((like) => like.track.id !== id),
    })),
  };
}

function withFirst(data: LikePages, track: Track): LikePages {
  const [first, ...rest] = data.pages;
  if (!first) return data;
  const like: LikedTrack = { likedAt: new Date().toISOString(), track };
  return { ...data, pages: [{ ...first, items: [like, ...first.items] }, ...rest] };
}

/**
 * Likes or unlikes a track. The heart and the lists change at once; if
 * SoundCloud refuses (its bot filter can), everything goes back and «Что не
 * так» says why, so a like never looks done when it is not.
 */
export function useToggleLike() {
  const client = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ track, liked }: { track: Track; liked: boolean }) =>
      liked ? unlikeTrack(track.id) : likeTrack(track.id),
    onMutate: ({ track, liked }) => {
      const before = client.getQueryData<LikePages>(ALL_LIKES);
      if (before)
        client.setQueryData<LikePages>(
          ALL_LIKES,
          liked ? without(before, track.id) : withFirst(before, track),
        );
      return { before };
    },
    onError: (error, { track, liked }, context) => {
      if (context?.before) client.setQueryData(ALL_LIKES, context.before);
      actionFailed(`like:${track.id}`, likeWords(track.title, !liked, error), error);
    },
    onSuccess: (_data, { track, liked }) => {
      if (liked) {
        usePlayer.getState().say(`Убрал из лайков: ${track.title}`, {
          label: "Вернуть",
          run: () => toggle.mutate({ track, liked: false }),
        });
      } else usePlayer.getState().say(`В лайках: ${track.title}`);
      // The home screen's short list catches up on its own time.
      void client.invalidateQueries({ queryKey: ["library", "likes"], exact: true });
    },
  });
  return (track: Track, liked: boolean) => toggle.mutate({ track, liked });
}
