import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, hasAdminToken, setAdminToken, type Block, type Booking, type Config, type Court } from "../lib/api";
import { useClub } from "../lib/data";
import { addDays, hhmm, niceDate, rsd } from "../lib/time";

const ROW = 30;
const field = "mt-1 w-full rounded-sm border border-ink/25 bg-white px-3 py-2";

type Schedule = { bookings: Booking[]; blocks: Block[] };
type Drag = { id: number; x0: number; y0: number; dCol: number; dRow: number; moved: boolean };

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const demo = import.meta.env.VITE_DEMO_LOGIN as string | undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await api<{ token: string }>("/api/admin/login", { method: "POST", body: { email, password } });
      setAdminToken(token);
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 max-w-sm rounded-sm bg-chalk p-7 text-ink">
      <h1 className="font-wide text-2xl font-extrabold">Prijava za osoblje</h1>
      {demo && <p className="mt-2 text-sm text-ink/70">Demo nalog: {demo}</p>}
      <label className="mt-5 block text-sm">
        Mejl
        <input required type="email" autoComplete="username" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm">
        Lozinka
        <input required type="password" autoComplete="current-password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert" className="mt-4 text-sm text-clay">{error}</p>}
      <button type="submit" className="mt-5 w-full rounded-full bg-ink py-2.5 font-semibold text-chalk">Prijavi se</button>
    </form>
  );
}

function Day({ config, courts, onLogout }: { config: Config; courts: Court[]; onLogout: () => void }) {
  const [date, setDate] = useState(config.today);
  const [data, setData] = useState<Schedule>({ bookings: [], blocks: [] });
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [open, setOpen] = useState<Booking | null>(null);
  const [blockAt, setBlockAt] = useState<{ court: string; start: number } | null>(null);
  const [blockOpen, setBlockOpen] = useState<Block | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const rows = (config.close - config.open) / 30;

  const load = useCallback(async () => {
    try {
      const res = await api<Schedule>(`/api/admin/schedule?from=${date}&days=1`, { admin: true });
      setData({ bookings: res.bookings.filter((b) => b.date === date), blocks: res.blocks.filter((b) => b.date === date) });
    } catch (err) {
      if ((err as ApiError).status === 401) onLogout();
      else setMessage((err as ApiError).message);
    }
  }, [date, onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (open || blockAt || blockOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open, blockAt, blockOpen]);

  const closeDialog = () => {
    setOpen(null);
    setBlockAt(null);
    setBlockOpen(null);
  };

  async function run(action: () => Promise<unknown>, ok?: string) {
    setMessage(null);
    try {
      await action();
      if (ok) setMessage(ok);
      closeDialog();
    } catch (err) {
      setMessage((err as ApiError).message);
    }
    load();
  }

  const move = (b: Booking, changes: Partial<Pick<Booking, "court" | "start" | "duration">>) =>
    run(() => api(`/api/admin/bookings/${b.id}`, { method: "PATCH", admin: true, body: changes }), "Rezervacija je pomerena.");

  function onPointerDown(e: React.PointerEvent, b: Booking) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: b.id!, x0: e.clientX, y0: e.clientY, dCol: 0, dRow: 0, moved: false });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !grid.current) return;
    const colWidth = grid.current.clientWidth / courts.length;
    const dCol = Math.round((e.clientX - drag.x0) / colWidth);
    const dRow = Math.round((e.clientY - drag.y0) / ROW);
    const moved = drag.moved || Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 6;
    if (dCol !== drag.dCol || dRow !== drag.dRow || moved !== drag.moved) setDrag({ ...drag, dCol, dRow, moved });
  }

  function onPointerUp(b: Booking) {
    if (!drag) return;
    const { dCol, dRow, moved } = drag;
    setDrag(null);
    if (!moved) return setOpen(b);
    const col = courts.findIndex((c) => c.slug === b.court) + dCol;
    if (col < 0 || col >= courts.length || (dCol === 0 && dRow === 0)) return;
    move(b, { court: courts[col].slug, start: b.start + dRow * 30 });
  }

  const top = (start: number) => ((start - config.open) / 30) * ROW;
  const confirmed = data.bookings.filter((b) => b.status === "confirmed");
  const cancelled = data.bookings.filter((b) => b.status === "cancelled");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Prethodni dan" onClick={() => setDate(addDays(date, -1))} className="rounded-full border border-chalk/20 px-3 py-1.5">‹</button>
          <button type="button" onClick={() => setDate(config.today)} className="rounded-full border border-chalk/20 px-3 py-1.5 text-sm">Danas</button>
          <button type="button" aria-label="Sledeći dan" onClick={() => setDate(addDays(date, 1))} className="rounded-full border border-chalk/20 px-3 py-1.5">›</button>
          <h1 className="ml-3 font-wide text-xl font-extrabold first-letter:uppercase md:text-2xl">{niceDate(date)}</h1>
        </div>
        <button type="button" onClick={onLogout} className="text-sm text-muted hover:text-chalk">Odjavi se</button>
      </div>
      <p className="mt-2 text-sm text-muted">
        {confirmed.length} rezervacija · prevuci rezervaciju da je pomeriš, klikni na prazno polje da blokiraš termin.
      </p>
      {message && <p role="status" className="mt-3 rounded-sm bg-chalk/10 px-3 py-2 text-sm">{message}</p>}

      <div className="mt-6 overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[56px_1fr]">
          <div />
          <div className="grid" style={{ gridTemplateColumns: `repeat(${courts.length}, 1fr)` }}>
            {courts.map((c) => (
              <p key={c.slug} className="pb-2 text-center font-narrow text-lg font-black uppercase">{c.name}</p>
            ))}
          </div>
          <div className="relative" style={{ height: rows * ROW }}>
            {Array.from({ length: rows / 2 }, (_, i) => (
              <span key={i} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-muted" style={{ top: i * 2 * ROW }}>
                {hhmm(config.open + i * 60)}
              </span>
            ))}
          </div>
          <div ref={grid} className="relative grid border-l border-chalk/10" style={{ gridTemplateColumns: `repeat(${courts.length}, 1fr)`, height: rows * ROW }}>
            {courts.map((c) => (
              <div key={c.slug} className="relative border-r border-chalk/10">
                {Array.from({ length: rows }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Blokiraj ${c.name} u ${hhmm(config.open + i * 30)}`}
                    onClick={() => setBlockAt({ court: c.slug, start: config.open + i * 30 })}
                    className={`block w-full hover:bg-chalk/5 ${i % 2 ? "border-b border-chalk/10" : "border-b border-chalk/[0.04]"}`}
                    style={{ height: ROW }}
                  />
                ))}
                {data.blocks.filter((k) => k.court === c.slug).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setBlockOpen(k)}
                    className="absolute inset-x-1 flex items-start overflow-hidden rounded-sm bg-[repeating-linear-gradient(135deg,#2a3854_0_6px,#1b2740_6px_12px)] px-2 text-left text-xs text-chalk/80"
                    style={{ top: top(k.start) + 1, height: (k.duration / 30) * ROW - 2 }}
                  >
                    Blokirano{k.reason && `: ${k.reason}`}
                  </button>
                ))}
                {confirmed.filter((b) => b.court === c.slug).map((b) => {
                  const d = drag?.id === b.id ? drag : null;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onPointerDown={(e) => onPointerDown(e, b)}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => onPointerUp(b)}
                      onKeyDown={(e) => e.key === "Enter" && setOpen(b)}
                      className={`absolute inset-x-1 flex touch-none flex-col items-start justify-start overflow-hidden rounded-sm bg-turf px-2 py-1 text-left text-xs leading-tight shadow ${d?.moved ? "z-10 cursor-grabbing ring-2 ring-ball" : "cursor-grab"}`}
                      style={{
                        top: top(b.start) + 1,
                        height: (b.duration / 30) * ROW - 2,
                        transform: d ? `translate(calc(${d.dCol} * (100% + 0.5rem)), ${d.dRow * ROW}px)` : undefined,
                      }}
                    >
                      <span className="block font-semibold">{hhmm(b.start)}–{hhmm(b.start + b.duration)}</span>
                      <span className="block truncate text-chalk/80">{b.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {cancelled.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          Otkazano ovog dana: {cancelled.map((b) => `${b.courtName} ${hhmm(b.start)} (${b.name})`).join(", ")}
        </p>
      )}

      <dialog ref={dialog} onClose={closeDialog} className="m-auto w-[min(26rem,92vw)] rounded-sm bg-chalk p-6 text-ink backdrop:bg-ink/70">
        {open && <BookingDialog booking={open} courts={courts} config={config} onMove={(c) => move(open, c)} onCancel={() => run(() => api(`/api/admin/bookings/${open.id}/cancel`, { method: "POST", admin: true }), "Rezervacija je otkazana.")} onClose={closeDialog} />}
        {blockAt && <BlockDialog at={blockAt} courts={courts} config={config} onSave={(body) => run(() => api("/api/admin/blocks", { method: "POST", admin: true, body: { ...body, date } }), "Termin je blokiran.")} onClose={closeDialog} />}
        {blockOpen && (
          <div>
            <p className="font-wide text-xl font-extrabold">Blokiran termin</p>
            <p className="mt-2 text-ink/75">
              {courts.find((c) => c.slug === blockOpen.court)?.name}, {hhmm(blockOpen.start)}–{hhmm(blockOpen.start + blockOpen.duration)}
              {blockOpen.reason && ` · ${blockOpen.reason}`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeDialog} className="rounded-full px-4 py-2 text-sm font-semibold">Zatvori</button>
              <button type="button" onClick={() => run(() => api(`/api/admin/blocks/${blockOpen.id}`, { method: "DELETE", admin: true }), "Blokada je uklonjena.")} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-chalk">
                Ukloni blokadu
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function BookingDialog({ booking, courts, config, onMove, onCancel, onClose }: {
  booking: Booking; courts: Court[]; config: Config;
  onMove: (c: { court: string; start: number }) => void; onCancel: () => void; onClose: () => void;
}) {
  const [court, setCourt] = useState(booking.court);
  const [start, setStart] = useState(booking.start);
  const starts = [];
  for (let t = config.open; t + booking.duration <= config.close; t += 30) starts.push(t);

  return (
    <div>
      <p className="font-narrow text-sm uppercase tracking-[0.25em] text-ink/60">{booking.code}</p>
      <p className="font-wide text-xl font-extrabold">{booking.name}</p>
      <p className="mt-1 text-ink/75">
        <a className="underline" href={`tel:${booking.phone}`}>{booking.phone}</a> · {booking.email}
      </p>
      <p className="mt-1 text-ink/75">{rsd(booking.price)}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="text-sm">
          Teren
          <select className={field} value={court} onChange={(e) => setCourt(e.target.value)}>
            {courts.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Početak
          <select className={field} value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {starts.map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="mr-auto rounded-full px-4 py-2 text-sm font-semibold text-clay">Otkaži rezervaciju</button>
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold">Zatvori</button>
        <button type="button" disabled={court === booking.court && start === booking.start} onClick={() => onMove({ court, start })} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-chalk disabled:opacity-40">
          Pomeri
        </button>
      </div>
    </div>
  );
}

function BlockDialog({ at, courts, config, onSave, onClose }: {
  at: { court: string; start: number }; courts: Court[]; config: Config;
  onSave: (body: { court: string; start: number; duration: number; reason: string }) => void; onClose: () => void;
}) {
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState("");
  const options = [30, 60, 90, 120, 180, 240].filter((d) => at.start + d <= config.close);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ court: at.court, start: at.start, duration, reason }); }}>
      <p className="font-wide text-xl font-extrabold">Blokiraj termin</p>
      <p className="mt-1 text-ink/75">{courts.find((c) => c.slug === at.court)?.name}, od {hhmm(at.start)}</p>
      <label className="mt-4 block text-sm">
        Trajanje
        <select className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          {options.map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h`}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Razlog (vidi ga samo osoblje)
        <input className={field} maxLength={120} placeholder="npr. turnir, održavanje" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold">Odustani</button>
        <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-chalk">Blokiraj</button>
      </div>
    </form>
  );
}

export default function Admin() {
  const { config, courts } = useClub();
  const [logged, setLogged] = useState(hasAdminToken());

  const logout = useCallback(() => {
    if (hasAdminToken()) api("/api/admin/logout", { method: "POST", admin: true }).catch(() => {});
    setAdminToken(null);
    setLogged(false);
  }, []);

  return (
    <main className="min-h-[100svh] px-5 py-6 md:px-10">
      <Link to="/" className="font-wide text-xl font-extrabold">REBOUND</Link>
      <span className="ml-3 text-sm text-muted">osoblje</span>
      <div className="mt-8">
        {!logged && <Login onDone={() => setLogged(true)} />}
        {logged && config && courts.length > 0 && <Day config={config} courts={courts} onLogout={logout} />}
      </div>
    </main>
  );
}
