import { LogOut, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Me, Plan } from "@/api/types";
import { roomForTrafficLights } from "@/app/chrome";
import { useSignOut } from "@/features/session/useSession";
import { Artwork } from "@/ui/Artwork";
import { Logo } from "@/ui/Mark";

export type Tab = "home" | "library" | "diary";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Главная" },
  { id: "library", label: "Библиотека" },
  { id: "diary", label: "Дневник" },
];

const PLANS: Record<Plan, string | null> = {
  free: null,
  go: "SoundCloud Go",
  "go-plus": "SoundCloud Go+",
  dj: "SoundCloud DJ",
  other: null,
};

const isMac = /Mac/.test(navigator.userAgent);

/** Search lives here; until it is built, the field says so instead of pretending. */
function SearchField() {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative ml-auto w-[340px] min-w-[180px] shrink">
      <label className="flex h-10 items-center gap-2.5 rounded-[20px] bg-white/[0.07] px-4 text-fg-muted transition-colors focus-within:bg-white/10">
        <Search className="size-5 shrink-0" aria-hidden="true" />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setQuery("")}
          placeholder="Трек, артист, плейлист"
          aria-label="Поиск"
          className="h-full min-w-0 flex-1 bg-transparent font-semibold text-fg outline-none placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="rounded-md bg-white/[0.08] px-[7px] py-1 font-bold font-sans text-[11px] leading-none">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </label>
      {query.trim() && (
        <p
          role="status"
          className="absolute inset-x-0 top-12 rounded-2xl border border-line bg-panel px-4 py-3 text-[13px] text-fg-muted shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]"
        >
          Поиск ещё не готов — он следующий в списке.
        </p>
      )}
    </div>
  );
}

function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const signOut = useSignOut();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !box.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const plan = PLANS[me.plan];
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Аккаунт ${me.user.username}`}
        className="block rounded-full"
      >
        <Artwork url={me.user.avatarUrl} size={100} eager className="size-[38px] rounded-full" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-12 right-0 w-60 rounded-2xl border border-line bg-panel p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]"
        >
          <div className="px-3 py-2.5">
            <b className="block truncate font-extrabold text-[14.5px]">{me.user.username}</b>
            <span className="font-bold text-[12.5px] text-fg-faint">
              {plan ?? "Бесплатный аккаунт"}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
            className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 font-bold text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            Выйти из аккаунта
          </button>
        </div>
      )}
    </div>
  );
}

/** The top bar floats over the light; once the page scrolls under it, it grows a backing. */
export function TopBar({
  me,
  tab,
  onTab,
  scrolled,
}: {
  me: Me;
  tab: Tab;
  onTab: (tab: Tab) => void;
  scrolled: boolean;
}) {
  return (
    <header
      data-tauri-drag-region
      className={`absolute inset-x-0 top-0 z-20 flex h-[68px] items-center gap-[30px] pr-7 transition-[background-color,backdrop-filter] duration-200 ${
        roomForTrafficLights ? "pl-[94px]" : "pl-7"
      } ${scrolled ? "bg-ground/80 backdrop-blur-xl" : ""}`}
    >
      <Logo />
      <nav aria-label="Разделы" className="ml-[18px] flex gap-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            aria-current={item.id === tab ? "page" : undefined}
            className="h-[38px] rounded-[19px] px-4 font-bold text-[15px] text-fg-muted transition-colors duration-150 hover:text-fg aria-[current=page]:bg-white/10 aria-[current=page]:text-fg"
          >
            {item.label}
          </button>
        ))}
      </nav>
      <SearchField />
      <AccountMenu me={me} />
    </header>
  );
}
