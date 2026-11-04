import { KeyRound, LoaderCircle, LogIn } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { ApiError } from "@/api/invoke";
import { roomForTrafficLights } from "@/app/chrome";
import { useSignInWithToken, useSignInWithWindow } from "@/features/session/useSession";
import { describeError } from "@/ui/errors";
import { Logo } from "@/ui/Mark";
import { Ribbon } from "@/ui/Ribbon";

const DISCLAIMER = "Неофициальный клиент. Не связан с SoundCloud. Используй на свой страх и риск.";

/** A full-window screen in the home's world: the light, one big word, one action. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <header
        data-tauri-drag-region
        className={`flex h-[68px] shrink-0 items-center pr-7 ${roomForTrafficLights ? "pl-[94px]" : "pl-7"}`}
      >
        <Logo />
      </header>
      <main className="grain relative isolate min-h-0 flex-1 overflow-clip bg-ground">
        <Ribbon
          playing={false}
          energy={0.9}
          pace={0.7}
          loudness={null}
          className="absolute inset-x-0 top-[calc(50%-300px)] h-[440px] w-full"
        />
        {/* Scrolls instead of clipping when a small window meets the open key form. */}
        <div className="relative z-10 flex h-full flex-col overflow-y-auto px-14">
          <div className="@container my-auto w-full max-w-[1100px] py-10">{children}</div>
          <p className="shrink-0 pb-6 font-bold text-[12.5px] text-fg-faint">{DISCLAIMER}</p>
        </div>
      </main>
    </div>
  );
}

function tokenProblem(error: unknown): string {
  const { kind } = ApiError.from(error);
  if (kind === "unauthorized")
    return "SoundCloud не принял этот ключ — скорее всего, он устарел. Скопируй свежий.";
  return describeError(error);
}

export function SignIn({ expired }: { expired: boolean }) {
  const viaWindow = useSignInWithWindow();
  const viaToken = useSignInWithToken();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [token, setToken] = useState("");
  const waiting = viaWindow.isPending;
  const closedWithoutSignIn = viaWindow.isSuccess && viaWindow.data === null;

  const submitToken = (event: FormEvent) => {
    event.preventDefault();
    if (token.trim()) viaToken.mutate(token);
  };

  return (
    <Stage>
      <h1 className="whitespace-nowrap font-display font-extrabold text-[length:min(132px,15cqi)] leading-[0.92] tracking-[-0.055em] [text-shadow:0_10px_50px_rgb(0_0_0/0.35)]">
        Cloudify
      </h1>
      <p className="mt-[18px] max-w-[46ch] text-[17px] text-white/80 leading-[1.45] [text-shadow:0_2px_16px_rgb(0_0_0/0.4)]">
        Твои лайки, плейлисты и подборка из того, что ты слушаешь, — в отдельном окне, без вкладок и
        рекламы.
      </p>
      {expired && (
        <p className="mt-4 inline-flex w-fit max-w-full items-center gap-2.5 rounded-full bg-[rgb(10_10_12/0.72)] px-4 py-2 font-bold text-[14px] text-fg">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-glow-1" />
          Вход устарел: SoundCloud больше не принимает старый ключ. Войди заново.
        </p>
      )}
      <div className="mt-[26px] flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => viaWindow.mutate()}
          disabled={waiting}
          className="flex h-[54px] items-center gap-2.5 rounded-full bg-white pr-[26px] pl-5 font-extrabold text-[16px] text-ink transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-[0.97] disabled:cursor-default disabled:hover:scale-100"
        >
          {waiting ? (
            <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="size-5" aria-hidden="true" />
          )}
          {waiting ? "Жду вход в окне SoundCloud…" : "Войти через SoundCloud"}
        </button>
        <button
          type="button"
          onClick={() => setTokenOpen((open) => !open)}
          aria-expanded={tokenOpen}
          className="flex h-[54px] items-center gap-2 rounded-full bg-[rgb(10_10_12/0.62)] px-5 font-bold text-[15px] text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] transition-colors hover:bg-[rgb(40_40_46/0.72)] hover:text-white"
        >
          <KeyRound className="size-[18px]" aria-hidden="true" />
          Вставить ключ вручную
        </button>
      </div>
      <p role="status" className="mt-4 min-h-5 max-w-[60ch] font-bold text-[13.5px] text-fg-muted">
        {waiting
          ? "Откроется страница входа SoundCloud. Войди там как обычно — окно закроется само."
          : viaWindow.isError
            ? describeError(viaWindow.error)
            : closedWithoutSignIn
              ? "Окно закрылось до входа. Можно попробовать ещё раз."
              : ""}
      </p>
      {tokenOpen && (
        <form onSubmit={submitToken} className="mt-2 max-w-[560px] rounded-[22px] bg-panel/95 p-4">
          <label htmlFor="token" className="block font-bold text-[13.5px]">
            Ключ входа <span className="text-fg-faint">(cookie oauth_token)</span>
          </label>
          <div className="mt-2.5 flex gap-2">
            <input
              id="token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="2-123456-…"
              className="h-11 min-w-0 flex-1 rounded-xl bg-white/[0.07] px-3.5 font-semibold text-fg outline-none placeholder:text-fg-faint focus-visible:outline-2 focus-visible:outline-glow-1"
            />
            <button
              type="submit"
              disabled={viaToken.isPending || !token.trim()}
              className="h-11 rounded-xl bg-white px-4 font-extrabold text-ink transition-opacity disabled:opacity-50"
            >
              {viaToken.isPending ? "Проверяю…" : "Войти"}
            </button>
          </div>
          <p className="mt-2.5 text-[12.5px] text-fg-muted leading-relaxed">
            {viaToken.isError
              ? tokenProblem(viaToken.error)
              : "На soundcloud.com, где ты уже вошёл: инструменты разработчика → Application (Хранилище) → Cookies → soundcloud.com → значение oauth_token."}
          </p>
        </form>
      )}
      <p className="mt-6 max-w-[60ch] text-[12.5px] text-fg-faint leading-relaxed">
        Пароль вводится на сайте SoundCloud — приложение его не видит. Cloudify хранит только ключ
        входа, в связке ключей системы, и отправляет его только в SoundCloud.
      </p>
    </Stage>
  );
}
