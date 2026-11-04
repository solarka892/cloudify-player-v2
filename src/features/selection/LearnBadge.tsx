import { LEARNING_PLAYS } from "@/features/selection/engine";
import type { Learning } from "@/features/selection/useSelection";

// The honest note of how much the selection has learned: ten marks filling up
// over its first thirty plays, «Правила по умолчанию» before the first one.
// Gone once it has learned enough to have most of the say.

export function LearnBadge({
  learning,
  plays,
  onLight = false,
}: {
  learning: Learning;
  plays: number;
  /** On the light it is smoke with a rim; on a panel, a quiet well. */
  onLight?: boolean;
}) {
  if (learning === "learned") return null;
  const lit = learning === "learning" ? Math.min(10, Math.round((plays / LEARNING_PLAYS) * 10)) : 0;
  const words =
    learning === "learning"
      ? `Учусь: ${plays} из ${LEARNING_PLAYS}`
      : learning === "unreadable"
        ? "Дневник не читается — по правилам"
        : "Правила по умолчанию";
  return (
    <span
      title={
        learning === "learning"
          ? `Подборка учится на дневнике: после ${LEARNING_PLAYS} прослушиваний выученное станет главнее правил`
          : "Подборка ещё ничего о тебе не выучила и играет по правилам: два лайка, потом трек со станции"
      }
      className={`inline-flex h-7 shrink-0 items-center gap-2 rounded-full pr-3 pl-2.5 font-bold text-[12.5px] ${
        onLight
          ? "bg-[rgb(10_10_12/0.66)] text-white/85 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)] backdrop-blur-[6px]"
          : "bg-white/[0.06] text-fg-muted"
      }`}
    >
      <span aria-hidden="true" className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: ten fixed marks
            key={i}
            className={`h-2.5 w-1 rounded-sm ${i < lit ? "bg-glow-1" : "bg-white/[0.22]"}`}
          />
        ))}
      </span>
      {words}
    </span>
  );
}
