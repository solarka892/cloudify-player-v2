import { Component, type ErrorInfo, Fragment, type ReactNode } from "react";
import { ApiError } from "@/api/invoke";
import { Held } from "@/features/problems/Held";
import { type Problem, useProblems } from "@/features/problems/store";
import { crashWords, type Part as Named } from "@/features/problems/words";

interface Props {
  /** What this part is, for «Подписки сломались». */
  name: Named;
  /**
   * Its shape while it cannot show itself: the quiet frames of its skeleton.
   * `null` for a part that floats over the page (a sheet): it just goes away,
   * and «Что не так» offers to bring it back.
   */
  frames: ReactNode;
  children: ReactNode;
}

interface State {
  broken: boolean;
  /** Each restart mounts the part afresh. */
  round: number;
}

const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

let parts = 0;

/**
 * One part of the window that may break on its own: when something inside it
 * throws, only this part turns into quiet frames, the rest keeps working, and
 * «Что не так» offers to show it afresh.
 */
export class Part extends Component<Props, State> {
  override state: State = { broken: false, round: 0 };
  private readonly id = `crash:${++parts}`;
  /** What broke, while it stays broken. */
  private crash: Omit<Problem, "at" | "resolvedAt"> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { broken: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.crash = {
      id: this.id,
      kind: "crash",
      ...crashWords(this.props.name),
      error: new ApiError("app", describe(error)),
      cause: error,
      restart: this.restart,
      stack: info.componentStack ?? undefined,
    };
    useProblems.getState().add(this.crash);
  }

  // Mounted again while still broken (development mounts everything twice): still a problem.
  override componentDidMount() {
    if (this.state.broken && this.crash) useProblems.getState().add(this.crash);
  }

  override componentWillUnmount() {
    // A part that is gone cannot be shown afresh.
    useProblems.getState().resolve(this.id);
  }

  private readonly restart = () => {
    this.crash = null;
    useProblems.getState().resolve(this.id);
    this.setState((s) => ({ broken: false, round: s.round + 1 }));
  };

  override render() {
    if (this.state.broken) {
      return this.props.frames === null ? null : (
        <Held problemId={this.id} frames={this.props.frames} />
      );
    }
    return <Fragment key={this.state.round}>{this.props.children}</Fragment>;
  }
}

/**
 * The last line: when even the window's frame breaks, say so plainly and offer
 * a restart. It leans on nothing that could be what broke.
 */
export class WholeApp extends Component<{ children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: describe(error) };
  }

  override componentDidCatch(_error: unknown, info: ErrorInfo) {
    const where = info.componentStack?.trim().split("\n").slice(0, 4).join("\n");
    if (where) this.setState((s) => ({ error: `${s.error ?? ""}\n${where}` }));
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    return (
      <main className="flex h-full flex-col justify-center gap-5 bg-ground px-14">
        <h1 className="font-display font-extrabold text-[length:min(132px,15vw)] leading-[0.92] tracking-[-0.055em]">
          Сломалось
        </h1>
        <p className="max-w-[52ch] text-pretty font-semibold text-[17px] text-white/80 leading-[1.45]">
          Что-то в Cloudify сломалось целиком. Перезапусти окно: вход сохранится, а музыка продолжит
          с того же места.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-[54px] w-fit rounded-full bg-white px-[26px] font-extrabold text-[16px] text-ink transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
        >
          Перезапустить окно
        </button>
        <code className="block max-h-40 max-w-[760px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white/5 px-3.5 py-3 font-mono font-semibold text-[12px] text-fg-muted">
          {this.state.error}
        </code>
      </main>
    );
  }
}
