import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { TrackFilters } from "@/api/types";
import { CREATED, DURATIONS, genreName, hasFilters, LICENSES } from "@/features/search/filters";
import { useGenres } from "@/features/search/queries";
import { formatCount } from "@/ui/format";

// The track filters as a column beside the list, like soundcloud.com's, in
// Cloudify's material: one panel, the choices as rows and small pills.

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-3 first:mt-0">
      <legend className="px-2 pt-1 pb-2 font-bold text-[12.5px] text-fg-faint">{title}</legend>
      {children}
    </fieldset>
  );
}

function Choice({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="flex h-[34px] w-full items-center gap-2 rounded-[10px] px-2.5 text-left font-bold text-[13.5px] text-fg-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-fg aria-pressed:bg-white/10 aria-pressed:text-fg"
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count != null && (
        <span className="font-bold text-[12px] text-fg-faint tabular-nums">
          {formatCount(count)}
        </span>
      )}
      {on && <Check className="size-4 shrink-0 text-glow-1" aria-hidden="true" />}
    </button>
  );
}

function Pills<T extends string>({
  options,
  value,
  any,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T | null | undefined;
  any: string;
  onChange: (value: T | null) => void;
}) {
  const pill =
    "h-[30px] rounded-full bg-white/[0.06] px-[11px] font-bold text-[13px] text-fg-muted transition-colors duration-150 hover:text-fg aria-pressed:bg-white aria-pressed:text-ink";
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-1">
      <button type="button" aria-pressed={!value} onClick={() => onChange(null)} className={pill}>
        {any}
      </button>
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(value === id ? null : id)}
          className={pill}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Genre, length, when it was added, what the licence allows, Go+ only. The
 * genres are the ones SoundCloud counts among this search's tracks, with how
 * many each has, so a choice never leads to an empty list by surprise.
 */
export function FilterColumn({
  query,
  filters,
  onChange,
}: {
  query: string;
  filters: TrackFilters;
  onChange: (filters: TrackFilters) => void;
}) {
  const genres = useGenres(query, filters, true);
  const set = (patch: TrackFilters) => onChange({ ...filters, ...patch });
  const chosen = filters.genre ?? null;
  // A chosen genre stays in the list even when the counts no longer name it.
  const shown =
    chosen && genres.data && !genres.data.some((g) => g.genre === chosen)
      ? [{ genre: chosen, count: null }, ...genres.data]
      : (genres.data ?? []);

  return (
    <aside
      aria-label="Фильтры треков"
      className="sticky top-[140px] max-h-[calc(100vh-84px-156px)] overflow-y-auto overscroll-contain rounded-[22px] bg-panel p-3.5"
    >
      <Group title="Жанр">
        <div>
          <Choice on={!chosen} onClick={() => set({ genre: null })}>
            Любой
          </Choice>
          {genres.isPending
            ? ["a", "b", "c", "d"].map((key) => (
                <span key={key} className="mx-2.5 my-3 block h-2.5 w-2/3 rounded bg-white/[0.06]" />
              ))
            : shown.map(({ genre, count }) => (
                <Choice
                  key={genre}
                  on={chosen === genre}
                  onClick={() => set({ genre: chosen === genre ? null : genre })}
                  {...(count != null ? { count } : {})}
                >
                  {genreName(genre)}
                </Choice>
              ))}
          {genres.isError && (
            <p className="px-2.5 py-1.5 font-bold text-[12.5px] text-fg-faint">
              Жанры не загрузились.
            </p>
          )}
        </div>
      </Group>
      <Group title="Длина">
        <div>
          <Pills
            options={DURATIONS}
            value={filters.duration}
            any="Любая"
            onChange={(duration) => set({ duration })}
          />
        </div>
      </Group>
      <Group title="Когда добавлен">
        <div>
          <Pills
            options={CREATED}
            value={filters.created}
            any="Когда угодно"
            onChange={(created) => set({ created })}
          />
        </div>
      </Group>
      <Group title="Лицензия">
        <div>
          <Choice on={!filters.license} onClick={() => set({ license: null })}>
            Любая
          </Choice>
          {LICENSES.map(([id, label]) => (
            <Choice
              key={id}
              on={filters.license === id}
              onClick={() => set({ license: filters.license === id ? null : id })}
            >
              {label}
            </Choice>
          ))}
        </div>
      </Group>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(filters.goPlusOnly)}
        onClick={() => set({ goPlusOnly: !filters.goPlusOnly })}
        className="group mt-3 flex h-10 w-full items-center justify-between rounded-xl px-2.5 font-bold text-[13.5px] text-fg transition-colors duration-150 hover:bg-white/[0.06]"
      >
        Только Go+
        <span className="relative h-[22px] w-9 rounded-full bg-white/[0.16] transition-colors duration-150 group-aria-checked:bg-glow-1">
          <span className="absolute top-[3px] left-[3px] size-4 rounded-full bg-white transition-transform duration-150 group-aria-checked:translate-x-3.5" />
        </span>
      </button>
      {hasFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="mx-1 mt-2.5 mb-0.5 h-8 rounded-full bg-white/10 px-3.5 font-bold text-[13px] text-fg transition-colors hover:bg-white/15"
        >
          Сбросить фильтры
        </button>
      )}
    </aside>
  );
}
