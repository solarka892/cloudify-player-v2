import type { Query, QueryClient } from "@tanstack/react-query";
import { ApiError, isRetryable } from "@/api/invoke";
import { session } from "@/api/session";
import { isActive, useConnection, useProblems } from "@/features/problems/store";
import { EXPIRED, loadWords, partOf, type Words } from "@/features/problems/words";

// Every request the app makes goes through TanStack Query, so failures are
// heard in one place: the query cache. A failed query becomes a problem the
// status button lists; the same query succeeding later solves it. A lost
// network and an expired sign-in are states of their own (`useConnection`).

/** A query as the cache hands it over: any data, any error. */
type AnyQuery = Query<unknown, unknown, unknown>;

const idOf = (query: AnyQuery) => `load:${query.queryHash}`;

/** How long to wait when SoundCloud asks to but does not say how long. */
const DEFAULT_WAIT_SECS = 30;
/** While offline, failed parts ask again this often. */
const OFFLINE_POLL_MS = 10_000;

const waits = new Map<string, ReturnType<typeof setTimeout>>();

function isPaged(data: unknown): data is { pages: unknown[] } {
  return (
    typeof data === "object" && data !== null && Array.isArray((data as { pages?: unknown }).pages)
  );
}

/** Asks again for every failed query on screen, or only those that failed this way. */
export function askAgain(client: QueryClient, kind?: ApiError["kind"]) {
  void client.refetchQueries({
    type: "active",
    predicate: (query) =>
      query.state.status === "error" &&
      (kind === undefined || ApiError.from(query.state.error).kind === kind),
  });
}

/** SoundCloud refused the sign-in: one problem for all of it, and the sheet that asks again. */
export function sessionExpired(error: unknown) {
  useConnection.getState().expire();
  useProblems.getState().add({
    id: "session",
    kind: "session",
    ...EXPIRED,
    error: ApiError.from(error),
    cause: error,
  });
}

export function queryFailed(client: QueryClient, error: unknown, query: AnyQuery) {
  const failed = ApiError.from(error);
  if (failed.kind === "network") useConnection.getState().lost();
  if (failed.kind === "unauthorized") {
    sessionExpired(error);
    return;
  }
  const part = partOf(query.queryKey);
  // Asked for in passing (a playlist fetched to play it): whoever asked tells it, as an action.
  if (!part || query.getObserversCount() === 0) return;
  const data = query.state.data;
  const paged = isPaged(data);
  // A refresh that failed while the last answer still shows is not worth a word.
  if (data !== undefined && !paged) return;
  const partial = paged && data.pages.length > 0;
  const words: Words = loadWords(part, failed, partial);
  const id = idOf(query);
  const again = () => void client.refetchQueries({ queryKey: query.queryKey, exact: true });

  let waitUntil: number | undefined;
  if (failed.kind === "rate-limited") {
    const secs = failed.retryAfterSecs ?? DEFAULT_WAIT_SECS;
    waitUntil = Date.now() + secs * 1000;
    clearTimeout(waits.get(id));
    waits.set(
      id,
      setTimeout(() => {
        waits.delete(id);
        again();
      }, secs * 1000),
    );
  }
  useProblems.getState().add({
    id,
    kind: "load",
    ...words,
    error: failed,
    cause: error,
    // Without a network, or while SoundCloud asks to wait, it is asked again by itself.
    retry: isRetryable(failed) && failed.kind !== "network" && !waitUntil ? again : undefined,
    waitUntil,
  });
}

export function querySucceeded(query: AnyQuery) {
  useProblems.getState().resolve(idOf(query));
  useConnection.getState().found();
}

/** A request outside a query (a like, a stream) failed or got through. */
export function requestFailed(error: unknown) {
  const failed = ApiError.from(error);
  if (failed.kind === "network") useConnection.getState().lost();
  if (failed.kind === "unauthorized") sessionExpired(error);
}

export function requestSucceeded() {
  useConnection.getState().found();
}

/**
 * Something the person did that did not happen: one entry in «Что не так», and
 * the status button catches the eye. An expired sign-in says it in its own sheet.
 */
export function actionFailed(id: string, words: Words, error: unknown) {
  const failed = ApiError.from(error);
  if (failed.kind === "unauthorized") return;
  useProblems
    .getState()
    .add({ id: `action:${id}`, kind: "action", ...words, error: failed, cause: error });
}

/**
 * Asks SoundCloud who is signed in: the smallest question there is. It tells a
 * network that is back even when nothing on screen failed (a track that would
 * not load), and a sign-in that died meanwhile.
 */
function probe() {
  session()
    .then((state) => {
      requestSucceeded();
      if (state.state !== "signed-in")
        sessionExpired(new ApiError("unauthorized", "SoundCloud refused the session", 401));
    })
    .catch(requestFailed);
}

/**
 * Keeps an eye on the network while it is gone: failed parts ask again every
 * few seconds and when the system says it is back. Returns the function that stops it.
 */
export function watchConnection(client: QueryClient): () => void {
  const retryOffline = () => {
    if (!useConnection.getState().offline) return;
    askAgain(client, "network");
    probe();
  };
  const timer = setInterval(retryOffline, OFFLINE_POLL_MS);
  window.addEventListener("online", retryOffline);
  // What could not load without the network loads as soon as it is back, and
  // what could not be done for want of it can be done again.
  const stop = useConnection.subscribe((now, before) => {
    if (!before.offline || now.offline) return;
    askAgain(client, "network");
    const problems = useProblems.getState();
    for (const problem of problems.list) {
      if (isActive(problem) && problem.kind === "action" && problem.error.kind === "network")
        problems.resolve(problem.id);
    }
  });
  return () => {
    clearInterval(timer);
    window.removeEventListener("online", retryOffline);
    stop();
  };
}
