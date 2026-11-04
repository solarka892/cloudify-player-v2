import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { session, signInWithToken, signInWithWindow, signOut } from "@/api/session";
import type { Me, SessionState } from "@/api/types";
import { forgetResumePoint } from "@/features/player/resume";
import { usePlayer } from "@/features/player/store";
import { useConnection, useProblems } from "@/features/problems/store";
import { askAgain } from "@/features/problems/watch";

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
    const before = client.getQueryData<SessionState>(sessionKey);
    const again = before?.state === "signed-in" && before.me.user.id === me.user.id;
    useConnection.getState().renewed();
    useProblems.getState().resolve("session");
    if (again) {
      // The same person back after the sign-in expired: everything stays, and what
      // could not load without it is asked for again.
      askAgain(client);
    } else {
      // A new account must not see the previous one's cached library, nor play its queue.
      if (before?.state === "signed-in") {
        usePlayer.getState().stop();
        forgetResumePoint();
      }
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
    }
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
      // What went wrong for this account is not the next one's news.
      useProblems.setState({ list: [], open: false, focus: null });
      useConnection.getState().renewed();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
      const signedOut: SessionState = { state: "signed-out" };
      client.setQueryData(sessionKey, signedOut);
    },
  });
}
