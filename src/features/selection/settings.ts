import { create } from "zustand";
import {
  DEFAULT_SETTINGS,
  NOVELTY_STEPS,
  type SelectionSettings,
  SOURCES,
  type SourceId,
  type SourceSetting,
} from "@/features/selection/engine";

// How «Подборка» is set: the familiar ↔ new balance and each source's switch
// and weight. Kept in the window's storage, like the volume.

const KEY = "cloudify.selection.settings";

/** The weights a source can take: less often, as usual, more often. */
export const WEIGHTS = [0.5, 1, 2] as const;

function sane(value: unknown): SelectionSettings {
  if (typeof value !== "object" || value === null) return DEFAULT_SETTINGS;
  const stored = value as { novelty?: unknown; sources?: Record<string, unknown> };
  const novelty =
    typeof stored.novelty === "number" && Number.isFinite(stored.novelty)
      ? Math.max(0, Math.min(NOVELTY_STEPS, Math.round(stored.novelty)))
      : DEFAULT_SETTINGS.novelty;
  const sources = { ...DEFAULT_SETTINGS.sources };
  for (const id of SOURCES) {
    const one = stored.sources?.[id] as Partial<SourceSetting> | undefined;
    if (!one) continue;
    sources[id] = {
      on: typeof one.on === "boolean" ? one.on : true,
      weight: WEIGHTS.find((w) => w === one.weight) ?? 1,
    };
  }
  return { novelty, sources };
}

function saved(): SelectionSettings {
  try {
    return sane(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(settings: SelectionSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: the settings hold for this run.
  }
}

interface SettingsStore {
  settings: SelectionSettings;
  setNovelty: (novelty: number) => void;
  setSource: (id: SourceId, patch: Partial<SourceSetting>) => void;
  reset: () => void;
}

export const useSelectionSettings = create<SettingsStore>()((set, get) => {
  const apply = (settings: SelectionSettings) => {
    set({ settings });
    save(settings);
  };
  return {
    settings: saved(),
    setNovelty: (novelty) => apply(sane({ ...get().settings, novelty })),
    setSource: (id, patch) => {
      const { settings } = get();
      apply(
        sane({
          ...settings,
          sources: { ...settings.sources, [id]: { ...settings.sources[id], ...patch } },
        }),
      );
    },
    reset: () => apply(DEFAULT_SETTINGS),
  };
});
