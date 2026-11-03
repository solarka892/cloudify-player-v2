// How numbers, lengths and dates read in the interface (Russian for now; this
// moves into the i18n dictionary when it exists).

const counts = new Intl.NumberFormat("ru-RU");

/** `1312` → `1 312`. */
export function formatCount(value: number): string {
  return counts.format(value);
}

/** `246` → `4:06`; an hour or more → `1:02:33`. */
export function formatSeconds(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = String(whole % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

export function formatDuration(ms: number): string {
  return formatSeconds(ms / 1000);
}

/** Russian plural: `plural(3, ["трек", "трека", "треков"])` → `трека`. */
export function plural(value: number, [one, few, many]: readonly [string, string, string]): string {
  const n = Math.abs(value) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

const dayAndMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

/** «сегодня», «вчера», «3 дня назад», then a date: «12 октября». */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;
  return dayAndMonth.format(then);
}
