import { ApiError, isRetryable } from "@/api/invoke";
import { Stage } from "@/features/session/SignIn";
import { describeError } from "@/ui/errors";

/** Signed in, but SoundCloud cannot be asked right now. The sign-in stays; only the answer is missing. */
export function Unreachable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const offline = ApiError.from(error).kind === "network";
  return (
    <Stage>
      <h1 className="whitespace-nowrap font-display font-extrabold text-[length:min(132px,15cqi)] leading-[0.92] tracking-[-0.055em] [text-shadow:0_10px_50px_rgb(0_0_0/0.35)]">
        {offline ? "Нет связи" : "Минутку"}
      </h1>
      <p className="mt-[18px] max-w-[46ch] text-[17px] text-white/80 leading-[1.45] [text-shadow:0_2px_16px_rgb(0_0_0/0.4)]">
        {describeError(error)} Вход сохранён — как только SoundCloud ответит, всё будет на месте.
      </p>
      {isRetryable(error) && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-[26px] h-[54px] w-fit rounded-full bg-white px-[26px] font-extrabold text-[16px] text-ink transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
        >
          Попробовать снова
        </button>
      )}
    </Stage>
  );
}
