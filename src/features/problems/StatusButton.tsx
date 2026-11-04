import {
  Check,
  ChevronDown,
  Copy,
  KeyRound,
  LoaderCircle,
  LogIn,
  RotateCcw,
  RotateCw,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type Group,
  grouped,
  isActive,
  type Problem,
  useConnection,
  useProblems,
} from "@/features/problems/store";
import { detailsOf, EXPIRED, reportOf } from "@/features/problems/words";
import { TokenForm } from "@/features/session/SignIn";
import { useSignInWithWindow } from "@/features/session/useSession";
import { describeError } from "@/ui/errors";
import { plural } from "@/ui/format";

// «Одно место»: whatever goes wrong gathers in one button in the top bar. It is
// there only while something is wrong, says what in a few words, and opens
// «Что не так»: each problem with why, what can be done and what SoundCloud
// answered. An expired sign-in turns it white and opens a sheet that asks again.

/** «Сеть вернулась» shows this long after the network is back. */
const BACK_MS = 3500;

const PROBLEMS = ["проблема", "проблемы", "проблем"] as const;

const clock = (at: number) =>
  new Date(at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/** Seconds left until SoundCloud's wait is over. */
function useSecondsLeft(until: number | undefined): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (until === undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until === undefined ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

export function Countdown({ until }: { until: number }) {
  return <b className="font-extrabold text-fg tabular-nums">{useSecondsLeft(until)}</b>;
}

const quietButton =
  "inline-flex h-8 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full bg-white/10 px-[13px] font-bold text-[13.5px] text-fg transition-colors hover:bg-white/[0.16] [&_svg]:size-4";
const moreButton =
  "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 font-extrabold text-[13.5px] text-fg-muted transition-colors hover:text-fg [&_svg]:size-4 [&_svg]:transition-transform aria-expanded:[&_svg]:rotate-180";

/** What SoundCloud answered, and a way to hand it over in a bug report. */
function Details({ problem }: { problem: Problem }) {
  const details = detailsOf(problem.error, problem.kind === "crash", problem.stack);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(reportOf(problem.title, problem.at, details)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const rows: [string, string][] = [
    ["Ответ SoundCloud", details.answer],
    ...(details.asked ? ([["Что спрашивали", details.asked]] as [string, string][]) : []),
    [
      "Когда",
      `${clock(problem.at)}${problem.resolvedAt ? ` · прошло в ${clock(problem.resolvedAt)}` : ""}`,
    ],
  ];
  return (
    <div className="mt-3 rounded-xl bg-white/[0.04] px-3.5 pt-3 pb-3.5">
      <dl className="grid gap-[9px] font-bold text-[13px] leading-[1.45]">
        {rows.map(([name, value]) => (
          <div key={name} className="grid grid-cols-[124px_minmax(0,1fr)] gap-3.5">
            <dt className="text-fg-faint">{name}</dt>
            <dd className="min-w-0 break-words text-fg">{value}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[124px_minmax(0,1fr)] gap-3.5">
          <dt className="text-fg-faint">Текст ответа</dt>
          <dd className="min-w-0">
            <code className="block max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-[10px] bg-white/5 px-[11px] py-[9px] font-mono font-semibold text-[12px] text-fg-muted leading-normal">
              {details.message}
            </code>
          </dd>
        </div>
      </dl>
      <button type="button" onClick={copy} className={`${quietButton} mt-3 bg-white/[0.08]`}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Скопировано" : "Скопировать для отчёта"}
      </button>
    </div>
  );
}

function ProblemCard({
  group,
  open,
  onToggle,
  hot,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  hot: boolean;
}) {
  const problem = group.lead;
  const ask = useConnection((s) => s.ask);
  const resolve = useProblems((s) => s.resolve);
  const past = !isActive(problem);
  const actions = [];
  if (!past) {
    if (problem.waitUntil !== undefined) {
      actions.push(
        <span
          key="wait"
          className="inline-flex h-8 items-center gap-[7px] whitespace-nowrap rounded-full bg-white/[0.06] px-[13px] font-extrabold text-[13px] text-fg-muted [&_svg]:size-[15px]"
        >
          <Timer aria-hidden="true" />
          Повторю сам через <Countdown until={problem.waitUntil} /> с
        </span>,
      );
    }
    if (group.retry) {
      actions.push(
        <button key="retry" type="button" onClick={group.retry} className={quietButton}>
          <RotateCw aria-hidden="true" />
          Повторить
        </button>,
      );
    }
    if (problem.restart) {
      actions.push(
        <button key="restart" type="button" onClick={problem.restart} className={quietButton}>
          <RotateCcw aria-hidden="true" />
          Перезапустить
        </button>,
      );
    }
    if (problem.kind === "session") {
      actions.push(
        <button key="sign-in" type="button" onClick={() => ask(true)} className={quietButton}>
          <LogIn aria-hidden="true" />
          Войти снова
        </button>,
      );
    }
    // Something that did not happen has nothing left to wait for: it is read and put away.
    if (problem.kind === "action") {
      actions.push(
        <button
          key="seen"
          type="button"
          onClick={() => {
            for (const id of group.ids) resolve(id);
          }}
          className={quietButton}
        >
          <Check aria-hidden="true" />
          Понятно
        </button>,
      );
    }
  }
  return (
    <article
      id={`problem-${problem.id}`}
      className={`rounded-2xl ${past ? "py-2.5" : "py-3.5"} pr-3.5 pl-4 ${hot ? "bg-white/[0.04]" : ""}`}
    >
      <b
        className={`block font-extrabold leading-[1.3] ${past ? "text-[14px] text-fg-muted" : "text-[15px]"}`}
      >
        {problem.title}
      </b>
      {!past && (
        <p className="mt-1 text-pretty font-semibold text-[13.5px] text-fg-muted leading-normal">
          {problem.text}
        </p>
      )}
      <div className={`flex flex-wrap items-center gap-1.5 ${past ? "mt-1.5" : "mt-3"}`}>
        {actions}
        <button type="button" onClick={onToggle} aria-expanded={open} className={moreButton}>
          Подробнее
          <ChevronDown aria-hidden="true" />
        </button>
        <span className="ml-auto font-bold text-[12.5px] text-fg-faint tabular-nums">
          {past && problem.resolvedAt ? `прошло в ${clock(problem.resolvedAt)}` : clock(problem.at)}
        </span>
      </div>
      {open && <Details problem={problem} />}
    </article>
  );
}

function ProblemsPanel() {
  const list = useProblems((s) => s.list);
  const focus = useProblems((s) => s.focus);
  const hide = useProblems((s) => s.hide);
  const now = grouped(list.filter(isActive));
  const past = grouped(list.filter((p) => !isActive(p)));
  // A part of the page asks for its own problem, which may be read as part of a group.
  const focused = focus ? (now.find((g) => g.ids.includes(focus))?.lead.id ?? focus) : null;
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set(focused ? [focused] : []),
  );

  useEffect(() => {
    if (!focused) return;
    setOpened((was) => new Set([...was, focused]));
    document.getElementById(`problem-${focused}`)?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  const toggle = (id: string) =>
    setOpened((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const card = (group: Group) => (
    <ProblemCard
      key={group.lead.id}
      group={group}
      open={opened.has(group.lead.id)}
      onToggle={() => toggle(group.lead.id)}
      hot={group.lead.id === focused}
    />
  );

  return (
    <section
      aria-label="Что не так"
      className="drop-in fixed top-[62px] right-[22px] z-40 max-h-[calc(100vh-190px)] w-[min(440px,calc(100vw-44px))] overflow-y-auto overscroll-contain rounded-[22px] border border-line bg-panel p-2 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]"
    >
      <header className="flex items-center gap-2.5 pt-2.5 pr-2 pb-1.5 pl-3">
        <h2 className="flex-1 font-bold font-display text-[19px] tracking-[-0.02em]">Что не так</h2>
        <button
          type="button"
          onClick={hide}
          aria-label="Закрыть"
          className="grid size-8 place-content-center rounded-full text-fg-muted transition-colors hover:bg-white/[0.08] hover:text-fg"
        >
          <X className="size-[18px]" aria-hidden="true" />
        </button>
      </header>
      {now.length > 0 ? (
        now.map(card)
      ) : (
        <p className="px-4 pt-2 pb-4 font-semibold text-[13.5px] text-fg-muted leading-normal">
          Сейчас всё работает. Если SoundCloud что-то не отдаст, это появится здесь, а кнопка
          наверху подскажет.
        </p>
      )}
      {past.length > 0 && (
        <>
          <h3 className="mx-4 mt-3.5 mb-1.5 font-bold text-[12.5px] text-fg-faint">Уже прошло</h3>
          {past.map(card)}
        </>
      )}
    </section>
  );
}

/** «Вход устарел»: the window stays as it is; signing in again brings everything back. */
function ExpiredSheet() {
  const ask = useConnection((s) => s.ask);
  const problem = useProblems((s) => s.list.find((p) => p.id === "session" && isActive(p)));
  const viaWindow = useSignInWithWindow();
  const [more, setMore] = useState(false);
  const [byKey, setByKey] = useState(false);
  const waiting = viaWindow.isPending;
  const note = waiting
    ? "Откроется страница входа SoundCloud. Войди там как обычно — окно закроется само."
    : viaWindow.isError
      ? describeError(viaWindow.error)
      : viaWindow.isSuccess && viaWindow.data === null
        ? "Окно закрылось до входа. Можно попробовать ещё раз."
        : null;

  return (
    <section
      role="alertdialog"
      aria-labelledby="expired-title"
      className="drop-in fixed top-[62px] right-[22px] z-40 max-h-[calc(100vh-190px)] w-[min(460px,calc(100vw-44px))] overflow-y-auto rounded-[22px] border border-line bg-panel px-[22px] pt-[22px] pb-5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]"
    >
      <h2
        id="expired-title"
        className="font-display font-extrabold text-[30px] leading-none tracking-[-0.045em]"
      >
        {EXPIRED.title}
      </h2>
      <p className="mt-2.5 text-pretty font-semibold text-[14px] text-fg-muted leading-normal">
        {EXPIRED.text}
      </p>
      <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => viaWindow.mutate()}
          disabled={waiting}
          className="flex h-[46px] items-center gap-2.5 rounded-full bg-white pr-[22px] pl-[18px] font-extrabold text-[15px] text-ink transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-[0.97] disabled:cursor-default disabled:hover:scale-100"
        >
          {waiting ? (
            <LoaderCircle className="size-[18px] motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="size-[18px]" aria-hidden="true" />
          )}
          {waiting ? "Жду вход в окне SoundCloud…" : "Войти снова"}
        </button>
        <button type="button" onClick={() => ask(false)} className={moreButton}>
          Позже
        </button>
        {problem && (
          <button
            type="button"
            onClick={() => setMore((open) => !open)}
            aria-expanded={more}
            className={moreButton}
          >
            Подробнее
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="mt-3 font-bold text-[13px] text-fg-muted">
          {note}
        </p>
      )}
      {more && problem && <Details problem={problem} />}
      <button
        type="button"
        onClick={() => setByKey((open) => !open)}
        aria-expanded={byKey}
        className="mt-4 inline-flex items-center gap-2 font-bold text-[13px] text-fg-faint transition-colors hover:text-fg"
      >
        <KeyRound className="size-4" aria-hidden="true" />
        Вставить ключ вручную
      </button>
      {byKey && <TokenForm className="mt-2.5 rounded-2xl bg-white/[0.04] p-3.5" />}
    </section>
  );
}

/** The one place for what is wrong, beside the account in the top bar. */
export function StatusButton() {
  const list = useProblems((s) => s.list);
  const open = useProblems((s) => s.open);
  const pings = useProblems((s) => s.pings);
  const show = useProblems((s) => s.show);
  const hide = useProblems((s) => s.hide);
  const offline = useConnection((s) => s.offline);
  const backAt = useConnection((s) => s.backAt);
  const expired = useConnection((s) => s.expired);
  const asking = useConnection((s) => s.asking);
  const ask = useConnection((s) => s.ask);
  const box = useRef<HTMLDivElement>(null);
  const [, redraw] = useState(0);

  const now = grouped(list.filter(isActive));
  const back = !offline && backAt !== null && Date.now() - backAt < BACK_MS;

  // «Сеть вернулась» goes away by itself.
  useEffect(() => {
    if (!back || backAt === null) return;
    const timer = setTimeout(() => redraw((n) => n + 1), backAt + BACK_MS - Date.now() + 50);
    return () => clearTimeout(timer);
  }, [back, backAt]);

  // A click elsewhere or Escape closes the list and the sheet.
  useEffect(() => {
    if (!open && !asking) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      const away =
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !box.current?.contains(event.target as Node);
      if (!away) return;
      hide();
      ask(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open, asking, hide, ask]);

  let label: ReactNode = null;
  if (expired) {
    label = (
      <>
        <LogIn aria-hidden="true" className="size-[17px]" />
        Войти снова
      </>
    );
  } else if (offline) {
    label = (
      <>
        <i
          aria-hidden="true"
          className="size-2 rounded-full bg-fg-faint motion-safe:animate-pulse"
        />
        Нет сети
      </>
    );
  } else if (now.length === 0 && back) {
    label = (
      <>
        <i aria-hidden="true" className="size-2 rounded-full bg-glow-1" />
        Сеть вернулась
      </>
    );
  } else if (now.length > 0) {
    const first = now[0];
    label = (
      <>
        <TriangleAlert aria-hidden="true" className="size-[17px] text-glow-1" />
        {now.length === 1 && first
          ? first.lead.short
          : `${now.length} ${plural(now.length, PROBLEMS)}`}
      </>
    );
  }

  const toggle = () => {
    if (expired) {
      hide();
      ask(!asking);
    } else if (open) hide();
    else show();
  };

  return (
    <div ref={box} className="relative shrink-0">
      {label && (
        <button
          key={pings}
          type="button"
          onClick={toggle}
          aria-expanded={expired ? asking : open}
          aria-haspopup="dialog"
          className={`flex h-[38px] items-center gap-[9px] whitespace-nowrap rounded-full pr-[15px] pl-3 font-extrabold text-[13.5px] transition-colors duration-150 ${
            expired
              ? "bg-white text-ink"
              : "bg-white/[0.08] text-fg hover:bg-white/[0.13] aria-expanded:bg-white/[0.16]"
          } ${pings > 0 ? "status-ping" : "status-in"}`}
        >
          {label}
        </button>
      )}
      {open && !expired && <ProblemsPanel />}
      {expired && asking && <ExpiredSheet />}
    </div>
  );
}
