import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, type Booking as BookingT, type Config, type Court } from "../lib/api";
import { COURT_NOTES, WAKING, prefetchAvailability, useAvailability, useSlow } from "../lib/data";
import { addDays, belgradeNowMinutes, dayNumber, dayShort, hhmm, monthShort, niceDate, priceFor, rsd, weekday } from "../lib/time";
import CourtMini from "./CourtMini";
import Ticket from "./Ticket";

gsap.registerPlugin(Flip);

type Props = {
  config: Config;
  courts: Court[];
  selected: string | null;
  onSelect: (slug: string) => void;
  reduced: boolean;
};

const input = "mt-1 w-full rounded-sm border border-chalk/20 bg-ink px-3 py-2.5 text-chalk placeholder:text-muted/60 focus:border-ball focus:outline-none";

export default function Booking({ config, courts, selected, onSelect, reduced }: Props) {
  const [date, setDate] = useState(config.today);
  const [duration, setDuration] = useState(90);
  const [start, setStart] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingT | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useAvailability(selected ? date : null, refresh);
  const slow = useSlow(loading);

  const formRef = useRef<HTMLFormElement>(null);
  const [formVisible, setFormVisible] = useState(false);
  const flipState = useRef<Flip.FlipState | null>(null);
  const cards = useRef<HTMLDivElement>(null);

  const pick = (slug: string) => {
    if (!reduced && cards.current) flipState.current = Flip.getState(cards.current.querySelectorAll("[data-flip-id]"));
    setStart(null);
    setError(null);
    onSelect(slug);
  };

  useLayoutEffect(() => {
    if (!flipState.current) return;
    Flip.from(flipState.current, { duration: 0.6, ease: "power3.inOut", absolute: true, nested: true });
    flipState.current = null;
  }, [selected]);

  useEffect(() => setStart(null), [date, duration]);

  useEffect(() => {
    if (selected && data) prefetchAvailability([addDays(date, 1), addDays(date, 2), addDays(date, -1)].filter((d) => d >= config.today && d <= addDays(config.today, config.daysAhead)));
  }, [selected, data, date, config.today]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(form);
    return () => observer.disconnect();
  }, [selected, done]);

  const days = useMemo(() => Array.from({ length: config.daysAhead + 1 }, (_, i) => addDays(config.today, i)), [config]);
  const nowMin = belgradeNowMinutes(config.now);
  const busy = data?.courts.find((c) => c.court === selected)?.busy || [];

  const slots = useMemo(() => {
    const list: { t: number; free: boolean; price: number }[] = [];
    for (let t = config.open; t + duration <= config.close; t += config.step) {
      const past = date === config.today && t <= nowMin;
      const taken = busy.some((b) => t < b.end && t + duration > b.start);
      list.push({ t, free: !past && !taken, price: priceFor(date, t, duration, config.prices, config.peakFrom) });
    }
    return list;
  }, [config, date, duration, busy, nowMin]);

  const court = courts.find((c) => c.slug === selected);
  const total = start === null ? 0 : priceFor(date, start, duration, config.prices, config.peakFrom);
  const weekend = [0, 6].includes(weekday(date));
  const durationLabel = duration === 60 ? "1 h" : duration === 90 ? "1,5 h" : "2 h";

  const goToForm = () => {
    formRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    formRef.current?.querySelector("input")?.focus({ preventScroll: true });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || start === null) return;
    setSending(true);
    setError(null);
    try {
      const booking = await api<BookingT>("/api/bookings", {
        method: "POST",
        body: { court: selected, date, start, duration, ...form },
      });
      setDone(booking);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      if (apiErr.code === "taken") {
        setStart(null);
        setRefresh((n) => n + 1);
      }
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const link = `#/rezervacija/${done.code}?t=${done.token}`;
    return (
      <div className="py-6">
        <Ticket booking={done} reduced={reduced}>
          <p className="mt-5 text-sm text-ink/70">
            Otvori rezervaciju i sačuvaj tu stranicu. Preko nje vidiš termin i otkazuješ ga najkasnije 2 sata ranije.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to={link.slice(1)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-chalk">
              Otvori rezervaciju
            </Link>
            <button
              type="button"
              className="rounded-full border border-ink/30 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setDone(null);
                setStart(null);
                setRefresh((n) => n + 1);
              }}
            >
              Nova rezervacija
            </button>
          </div>
        </Ticket>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={cards}
        className={
          selected
            ? "flex gap-2 overflow-x-auto no-scrollbar"
            : "flex snap-x snap-mandatory gap-4 overflow-x-auto no-scrollbar md:grid md:grid-cols-4 md:overflow-visible"
        }
        role="radiogroup"
        aria-label="Izaberi teren"
      >
        {courts.map((c) => {
          const active = c.slug === selected;
          return (
            <button
              key={c.slug}
              type="button"
              role="radio"
              aria-checked={active}
              data-flip-id={c.slug}
              onClick={() => pick(c.slug)}
              className={
                selected
                  ? `flex shrink-0 items-center gap-3 rounded-full border px-4 py-2 text-left transition-colors ${
                      active ? "border-ball bg-ball text-ink" : "border-chalk/20 hover:border-chalk/50"
                    }`
                  : "group w-[70vw] shrink-0 snap-start overflow-hidden rounded-sm border border-chalk/15 text-left hover:border-ball sm:w-[40vw] md:w-auto"
              }
            >
              {!selected && <CourtMini slug={c.slug} indoor={c.indoor} className="h-auto w-full transition-transform duration-500 group-hover:scale-105" />}
              <span className={selected ? "font-name text-base font-extrabold uppercase" : "block px-4 pt-3 font-name text-2xl font-extrabold uppercase"}>
                {c.name}
              </span>
              {!selected && <span className="block px-4 pb-4 pt-1 text-sm text-muted">{c.indoor ? "Pod krovom" : "Napolju"}</span>}
            </button>
          );
        })}
      </div>

      {selected && court && (
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="min-w-0">
            <p className="text-muted">{COURT_NOTES[court.slug]}</p>

            <fieldset className="mt-6 min-w-0">
              <legend className="font-narrow text-sm uppercase tracking-[0.25em] text-ball">Dan</legend>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={d === date}
                    aria-label={niceDate(d)}
                    onClick={() => setDate(d)}
                    className={`flex w-14 shrink-0 flex-col items-center rounded-sm border py-2 ${
                      d === date ? "border-ball bg-ball text-ink" : "border-chalk/15 hover:border-chalk/50"
                    }`}
                  >
                    <span className="text-xs uppercase">{dayShort(d)}</span>
                    <span className="font-narrow text-2xl font-black leading-none">{dayNumber(d)}</span>
                    <span className="text-[11px] opacity-70">{monthShort(d)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6 min-w-0">
              <legend className="font-narrow text-sm uppercase tracking-[0.25em] text-ball">Trajanje</legend>
              <div className="mt-3 inline-flex rounded-full border border-chalk/20 p-1">
                {config.durations.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={d === duration}
                    onClick={() => setDuration(d)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${d === duration ? "bg-chalk text-ink" : "text-chalk/80"}`}
                  >
                    {d === 60 ? "1 h" : d === 90 ? "1,5 h" : "2 h"}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6 min-w-0">
              <legend className="font-narrow text-sm uppercase tracking-[0.25em] text-ball">Početak</legend>
              <p className="mt-2 text-sm text-muted">
                Ispod vremena je cena za {durationLabel}.{" "}
                {weekend ? `Vikendom ${rsd(config.prices.peak)} po satu.` : `Do 16 h ${rsd(config.prices.offPeak)} po satu, od 16 h ${rsd(config.prices.peak)}.`}
              </p>
              <div className={`mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
                {slots.map(({ t, free, price }) => (
                  <button
                    key={t}
                    type="button"
                    disabled={!free}
                    aria-pressed={t === start}
                    onClick={() => setStart(t)}
                    aria-label={free ? `${hhmm(t)}, ${rsd(price)}` : `${hhmm(t)}, zauzeto`}
                    className={`rounded-sm border py-1.5 text-sm leading-tight tabular-nums ${
                      t === start
                        ? "border-ball bg-ball font-bold text-ink"
                        : free
                          ? "border-chalk/20 hover:border-chalk/60"
                          : "cursor-not-allowed border-transparent text-chalk/25 line-through"
                    }`}
                  >
                    <span className="block">{hhmm(t)}</span>
                    {free && <span className={`block text-[11px] ${t === start ? "" : "text-chalk/55"}`}>{price.toLocaleString("sr-RS")}</span>}
                  </button>
                ))}
              </div>
              {loading && slow && <p className="mt-3 text-sm text-muted" aria-live="polite">{WAKING}</p>}
              {!loading && slots.every((s) => !s.free) && <p className="mt-3 text-sm text-muted">Za ovaj dan nema slobodnih termina na ovom terenu.</p>}
            </fieldset>
          </div>

          <form ref={formRef} onSubmit={submit} className="scroll-mt-6 self-start rounded-sm border border-chalk/15 bg-ink-2 p-6">
            <p className="font-narrow text-sm uppercase tracking-[0.25em] text-ball">Rezervacija</p>
            <p className="mt-2 font-wide text-2xl font-extrabold">
              {court.name}
              <span className="mt-1 block font-sans text-base font-normal text-chalk/80 first-letter:uppercase">
                {niceDate(date)}
                {start !== null && `, ${hhmm(start)}–${hhmm(start + duration)}`}
              </span>
            </p>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-chalk/10 pt-4">
              <span className="text-sm text-muted">{start === null ? "Izaberi početak termina." : `Ukupno za ${durationLabel}`}</span>
              {start !== null && <span className="whitespace-nowrap font-narrow text-3xl font-black">{rsd(total)}</span>}
            </div>

            <label className="mt-5 block text-sm">
              Ime i prezime
              <input required minLength={2} autoComplete="name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="mt-3 block text-sm">
              Mejl
              <input required type="email" autoComplete="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="mt-3 block text-sm">
              Telefon
              <input required type="tel" autoComplete="tel" placeholder="06x xxx xxxx" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>

            {error && (
              <p role="alert" className="mt-4 rounded-sm bg-clay/20 px-3 py-2 text-sm text-chalk">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={start === null || sending}
              className="mt-5 w-full rounded-full bg-ball py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Šaljem…" : "Potvrdi rezervaciju"}
            </button>
            <p className="mt-3 text-xs text-muted">Plaća se na recepciji. Otkazivanje najkasnije 2 sata ranije, preko stranice rezervacije.</p>
          </form>
        </div>
      )}

      {selected && court && start !== null && !formVisible && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-chalk/15 bg-ink/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm text-chalk/80">
              {court.name}, {hhmm(start)}–{hhmm(start + duration)}
            </p>
            <p className="font-narrow text-2xl font-black leading-tight">{rsd(total)}</p>
          </div>
          <button type="button" onClick={goToForm} className="shrink-0 rounded-full bg-ball px-5 py-2.5 font-semibold text-ink">
            Nastavi
          </button>
        </div>
      )}
    </div>
  );
}
