import { Shell } from "@/app/Shell";
import { SignIn, Stage } from "@/features/session/SignIn";
import { Unreachable } from "@/features/session/Unreachable";
import { useSession } from "@/features/session/useSession";

/** Signed in → the app; signed out or expired → sign-in; SoundCloud unreachable → says so. */
export function App() {
  const session = useSession();

  if (session.isPending) return <Stage>{null}</Stage>;
  if (session.isError) {
    return <Unreachable error={session.error} onRetry={() => void session.refetch()} />;
  }
  const state = session.data;
  if (state.state === "signed-in") return <Shell me={state.me} />;
  return <SignIn expired={state.state === "expired"} />;
}
