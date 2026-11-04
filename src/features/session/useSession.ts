import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { session, signInWithToken, signInWithWindow, signOut } from "@/api/session";
import type { Me, SessionState } from "@/api/types";
import { forgetResumePoint } from "@/features/player/resume";
import { usePlayer } from "@/features/player/store";

export const sessionKey = ["session"] as const;

/** Who is signed in. Asked once; sign-in and sign-out write the answer themselves. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: session,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

function useSignedIn() {
  const client = useQueryClient();
  return (me: Me | null) => {
    if (!me) return;
    // A new account must not see the previous one's cached library.
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
    const signedIn: SessionState = { state: "signed-in", me };
    client.setQueryData(sessionKey, signedIn);
  };
}

export function useSignInWithWindow() {
  const signedIn = useSignedIn();
  return useMutation({ mutationFn: signInWithWindow, onSuccess: signedIn });
}

export function useSignInWithToken() {
  const signedIn = useSignedIn();
  return useMutation({ mutationFn: signInWithToken, onSuccess: signedIn });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      usePlayer.getState().stop();
      forgetResumePoint();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
      const signedOut: SessionState = { state: "signed-out" };
      client.setQueryData(sessionKey, signedOut);
    },
  });
}

/** The session ended underneath us (SoundCloud refused the token mid-use). Stable across renders. */
export function useSessionExpired() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: sessionKey }), [client]);
}
