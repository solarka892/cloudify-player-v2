import { call } from "@/api/invoke";
import type { Me, SessionState } from "@/api/types";

/** Who is signed in. Reads the keychain once per run, then checks the token with SoundCloud. */
export function session(): Promise<SessionState> {
  return call<SessionState>("session");
}

/**
 * Opens SoundCloud's own sign-in page in a separate window and waits.
 * `null` when the person closed the window without signing in.
 */
export function signInWithWindow(): Promise<Me | null> {
  return call<Me | null>("sign_in_with_window");
}

/** The fallback: an `oauth_token` copied from soundcloud.com by hand. */
export function signInWithToken(token: string): Promise<Me> {
  return call<Me>("sign_in_with_token", { token });
}

export function signOut(): Promise<void> {
  return call<void>("sign_out");
}
