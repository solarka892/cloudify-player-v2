import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError, isRetryable } from "@/api/invoke";
import {
  queryFailed,
  querySucceeded,
  requestFailed,
  requestSucceeded,
} from "@/features/problems/watch";

export const queryClient: QueryClient = new QueryClient({
  // Failures are heard here, once, for the whole app: see `features/problems`.
  queryCache: new QueryCache({
    onError: (error, query) => queryFailed(queryClient, error, query),
    onSuccess: (_data, query) => querySucceeded(query),
  }),
  mutationCache: new MutationCache({
    onError: (error) => requestFailed(error),
    onSuccess: () => requestSucceeded(),
  }),
  defaultOptions: {
    queries: {
      // The library changes when the person changes it on SoundCloud — rarely, not every second.
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Ask again only when asking again could help (a dropped connection, not an expired sign-in),
      // and never sooner than SoundCloud asked: a wait is kept by `features/problems`.
      retry: (failures, error) =>
        failures < 2 && isRetryable(error) && ApiError.from(error).kind !== "rate-limited",
      // Requests go through Rust, which knows better than the webview whether the network is up:
      // ask anyway and let a failure say so, instead of waiting on the browser's guess.
      networkMode: "always",
    },
    mutations: { networkMode: "always" },
  },
});
