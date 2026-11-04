import type { User } from "@/api/types";
import { fold } from "@/features/library/filter";

/** How far down SoundCloud's people results the best match may sit. */
const NEAR_TOP = 3;
/** A following that makes a same-named account the artist rather than a namesake. */
const REAL_FOLLOWING = 5000;

/** Typed letters it takes before a name is guessed from its start. */
const PREFIX_FROM = 3;

/**
 * The artist a search most likely means: one of the first few people
 * SoundCloud finds whose name is the query itself, verified or with a real
 * following. Search «pyrokinesis» and it is pyrokinesis; search «deep house»
 * and it is nobody, since no artist is called that. While typing (`prefix`),
 * a name that starts with what is typed so far will do: «pyro» → pyrokinesis.
 */
export function bestArtist(
  users: readonly User[],
  query: string,
  { prefix = false }: { prefix?: boolean } = {},
): User | null {
  const wanted = fold(query);
  if (!wanted || (prefix && wanted.length < PREFIX_FROM)) return null;
  const named = (name: string | null) => {
    const folded = name ? fold(name) : "";
    return prefix ? folded.startsWith(wanted) : folded === wanted;
  };
  return (
    users
      .slice(0, NEAR_TOP)
      .find(
        (user) =>
          (named(user.username) || named(user.fullName)) &&
          (user.verified || (user.followersCount ?? 0) >= REAL_FOLLOWING),
      ) ?? null
  );
}
