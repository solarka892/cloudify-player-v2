import { Keyboard, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Me, Plan } from "@/api/types";
import { roomForTrafficLights } from "@/app/chrome";
import { Keys } from "@/features/player/KeysHelp";
import { usePanels } from "@/features/player/panels";
import { SearchField } from "@/features/search/SearchField";
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
            onClick={() => {
              setOpen(false);
              usePanels.getState().showKeys(true);
            }}
            className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 font-bold text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
          >
            <Keyboard className="size-[18px]" aria-hidden="true" />
            <span className="flex-1 text-left">Горячие клавиши</span>
            <Keys caps={["?"]} small />
          </button>
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
  /** `null` while the search page is open: then no tab is current. */
  tab: Tab | null;
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
