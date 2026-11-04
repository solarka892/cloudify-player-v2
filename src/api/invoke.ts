import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/api/app";
import type { ErrorKind } from "@/api/types";

/** A refused command, as Rust's `CommandError` serializes it. */
export class ApiError extends Error {
  readonly kind: ErrorKind;
  readonly status: number | null;
  readonly retryAfterSecs: number | null;
  /** The command that was refused, for «Подробнее»; set by `call`. */
  command: string | null = null;

  constructor(
    kind: ErrorKind,
    message: string,
    status: number | null = null,
    retryAfterSecs: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryAfterSecs = retryAfterSecs;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (typeof error === "object" && error !== null && "kind" in error) {
      const raw = error as {
        kind: ErrorKind;
        message?: string;
        status?: number | null;
        retryAfterSecs?: number | null;
      };
      return new ApiError(
        raw.kind,
        raw.message ?? raw.kind,
        raw.status ?? null,
        raw.retryAfterSecs ?? null,
      );
    }
    return new ApiError("app", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Calls a Rust command. In a plain browser tab (`pnpm dev` without Tauri) a
 * development-only stand-in answers instead, so screens can be worked on
 * without the app; production builds leave it out entirely.
 */
export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    if (isTauri()) return await invoke<T>(command, args);
    if (import.meta.env.DEV) {
      const { answer } = await import("@/dev/backend");
      return (await answer(command, args)) as T;
    }
    throw new ApiError("app", "Cloudify only works inside its own window");
  } catch (error) {
    const refused = ApiError.from(error);
    refused.command ??= command;
    throw refused;
  }
}

/** Whether asking again could change the answer. */
export function isRetryable(error: unknown): boolean {
  const kind = ApiError.from(error).kind;
  return kind === "network" || kind === "rate-limited" || kind === "client-id" || kind === "api";
}
