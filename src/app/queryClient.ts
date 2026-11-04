import { QueryClient } from "@tanstack/react-query";
import { isRetryable } from "@/api/invoke";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The library changes when the person changes it on SoundCloud — rarely, not every second.
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Ask again only when asking again could help (a dropped connection, not an expired sign-in).
      retry: (failures, error) => failures < 2 && isRetryable(error),
    },
  },
});
