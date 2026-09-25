import { useEffect, useMemo, useState } from "react";
import type { DateValue, TimeValue } from "@/types";

type Props = {
  date: DateValue;
  time?: TimeValue | null;
  label?: string;
};

function targetMs(date: DateValue, time?: TimeValue | null): number {
  const hours = time?.hour ?? 0;
  const minutes = time?.minute ?? 0;
  const month = date.month ?? 1;
  const day = date.day ?? 1;
  return new Date(date.year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function partsFrom(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, done: ms <= 0 };
}

export function CountdownSection({ date, time, label = "Until we celebrate" }: Props) {
  const target = useMemo(() => targetMs(date, time), [date, time]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { days, hours, minutes, seconds, done } = partsFrom(target - now);

  const cells = [
    { value: days, unit: "Days" },
    { value: hours, unit: "Hours" },
    { value: minutes, unit: "Minutes" },
    { value: seconds, unit: "Seconds" },
  ];

  return (
    <section className="animate-fade-up text-center" aria-live="polite">
      <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">Save the date</p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">
        {done ? "It's the day" : label}
      </h2>
      <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden />

      {done ? (
        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-ink-muted">
          The celebration is underway — we hope you can join.
        </p>
      ) : (
        <ol className="mx-auto mt-8 grid max-w-lg grid-cols-4 gap-2 sm:gap-3">
          {cells.map((cell) => (
            <li
              key={cell.unit}
              className="rounded-2xl border border-stone-200/70 bg-white/90 px-2 py-4 shadow-soft backdrop-blur-sm sm:px-3 sm:py-5"
            >
              <span className="block font-serif text-2xl tabular-nums tracking-tight text-ink sm:text-4xl">
                {String(cell.value).padStart(2, "0")}
              </span>
              <span className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-ink-muted sm:text-xs">
                {cell.unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
