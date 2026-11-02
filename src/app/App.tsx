import { useEffect, useState } from "react";
import { type AppInfo, appInfo, isTauri } from "@/api/app";

// A stand-in until the new design is picked: it only proves the window opens
// and the Rust side answers.
export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (isTauri()) appInfo().then(setInfo, console.error);
  }, []);

  return (
    <main className="grid min-h-dvh place-content-center gap-2 bg-neutral-950 text-center text-neutral-100">
      <h1 className="font-semibold text-3xl tracking-tight">Cloudify</h1>
      <p className="text-neutral-400 text-sm">
        {info ? `${info.name} ${info.version}` : "Новая версия собирается"}
      </p>
    </main>
  );
}
