import { LogIn, Timer, TriangleAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/api/invoke";
import { Countdown } from "@/features/problems/StatusButton";
import { isActive, type Problem, useConnection, useProblems } from "@/features/problems/store";

/** The problem a part of the page had: by the error its query threw, or by its own id. */
function useProblem(error: unknown, id: string | undefined): Problem | null {
  return useProblems(
    (s) =>
      s.list.find((p) => isActive(p) && (id !== undefined ? p.id === id : p.cause === error)) ??
      null,
  );
}

const linkButton =
  "rounded font-extrabold text-glow-1 hover:underline hover:underline-offset-2 focus-visible:underline";

/**
 * One quiet line: why this part is empty and when it fills, with a way to «Что
 * не так». `rest`: the part shows what loaded, and the line is about the rest.
 */
function HeldLine({ error, id, rest }: { error: unknown; id: string | undefined; rest: boolean }) {
  const problem = useProblem(error, id);
  const show = useProblems((s) => s.show);
  const ask = useConnection((s) => s.ask);
  const kind = problem?.error.kind ?? ApiError.from(error).kind;
  const whatHappened = problem && (
    <>
      {" · "}
      <button type="button" onClick={() => show(problem.id)} className={linkButton}>
        что случилось
      </button>
    </>
  );

  if (problem?.kind === "crash") {
    return (
      <>
        <TriangleAlert aria-hidden="true" />
        Сломалось{whatHappened}
      </>
    );
  }
  if (kind === "unauthorized" || kind === "sign-in-required") {
    return (
      <>
        <LogIn aria-hidden="true" />
        {rest ? "Остальное загрузится" : "Загрузится"} после входа ·{" "}
        <button type="button" onClick={() => ask(true)} className={linkButton}>
          войти снова
        </button>
      </>
    );
  }
  if (kind === "network") {
    return (
      <>
        <WifiOff aria-hidden="true" />
        {rest ? "Остальное догрузится" : "Догрузится"}, когда появится сеть
      </>
    );
  }
  if (problem?.waitUntil !== undefined) {
    return (
      <>
        <Timer aria-hidden="true" />
        {rest ? "Остальное догрузится" : "Догрузится"} через <Countdown until={problem.waitUntil} />{" "}
        с
      </>
    );
  }
  return (
    <>
      <TriangleAlert aria-hidden="true" />
      {rest ? "Загрузилось не всё" : "Не загрузилось"}
      {whatHappened}
    </>
  );
}

const pill =
  "inline-flex h-9 max-w-full items-center gap-2 whitespace-nowrap rounded-full bg-[rgb(10_10_12/0.86)] pr-3.5 pl-3 font-bold text-[13.5px] text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] backdrop-blur-md [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-glow-1";

/**
 * A part SoundCloud did not give, or that broke: it keeps its shape as quiet
 * empty frames, with one line over them. The reasons and the buttons live in
 * «Что не так», one click away. With `rest` there are no frames, only the line,
 * under a long list that loaded part way.
 */
export function Held({
  error,
  problemId,
  frames,
  rest = false,
  className = "",
}: {
  error?: unknown;
  /** For a part that broke: its own problem, not a query's. */
  problemId?: string;
  frames?: ReactNode;
  rest?: boolean;
  className?: string;
}) {
  const line = (
    <p role="status" className={pill}>
      <HeldLine error={error} id={problemId} rest={rest} />
    </p>
  );
  if (!frames) return <div className={`mt-3 ${className}`}>{line}</div>;
  return (
    <div className={`relative ${className}`}>
      <div aria-hidden="true" className="pointer-events-none opacity-45">
        {frames}
      </div>
      <div className="absolute top-3.5 left-3.5 max-w-[calc(100%-28px)]">{line}</div>
    </div>
  );
}
