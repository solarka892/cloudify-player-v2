const PAGES = {
  diary: {
    title: "Дневник",
    line: "Что ты слушал по дням и частям суток и чем закончилось: дослушал, пропустил, лайкнул. Появится, когда приложение начнёт его вести.",
  },
} as const;

/** A section that is not built yet says so plainly. */
export function ComingSoon({ page }: { page: keyof typeof PAGES }) {
  const { title, line } = PAGES[page];
  return (
    <section className="px-14 pt-[112px] pb-14">
      <h1 className="font-display font-extrabold text-[clamp(64px,8vw,112px)] leading-[0.92] tracking-[-0.055em]">
        {title}
      </h1>
      <p className="mt-[18px] max-w-[52ch] text-[17px] text-fg-muted leading-[1.45]">{line}</p>
    </section>
  );
}
