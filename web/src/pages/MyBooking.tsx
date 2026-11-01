import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Ticket from "../components/Ticket";
import { ApiError, api, type Booking } from "../lib/api";
import { useReducedMotion } from "../lib/motion";
import { hhmm } from "../lib/time";

export default function MyBooking() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const reduced = useReducedMotion();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    api<Booking>(`/api/bookings/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`)
      .then(setBooking)
      .catch((e: ApiError) => setError(e.message));
  }, [code, token]);

  async function cancel() {
    setBusy(true);
    try {
      setBooking(await api<Booking>(`/api/bookings/${encodeURIComponent(code)}/cancel`, { method: "POST", body: { token } }));
      dialog.current?.close();
    } catch (e) {
      setError((e as ApiError).message);
      dialog.current?.close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100svh] px-5 py-10 md:px-10">
      <Link to="/" className="font-wide text-xl font-extrabold">
        REBOUND
      </Link>
      <div className="mx-auto mt-14 max-w-md">
        <h1 className="mb-8 font-wide text-3xl font-extrabold">Tvoja rezervacija</h1>
        {error && (
          <p role="alert" className="mb-6 rounded-sm bg-clay/20 px-4 py-3">
            {error}
          </p>
        )}
        {!booking && !error && <p className="text-muted">Učitavam…</p>}
        {booking && (
          <Ticket booking={booking} reduced={reduced}>
            {booking.status === "confirmed" && (
              <button
                type="button"
                onClick={() => dialog.current?.showModal()}
                className="mt-6 rounded-full border border-clay px-4 py-2 text-sm font-semibold text-clay hover:bg-clay hover:text-chalk"
              >
                Otkaži rezervaciju
              </button>
            )}
          </Ticket>
        )}
        <Link to="/" className="mt-10 inline-block text-sm text-muted hover:text-chalk">
          ← Nazad na početnu
        </Link>
      </div>

      <dialog ref={dialog} className="m-auto max-w-sm rounded-sm bg-chalk p-6 text-ink backdrop:bg-ink/70">
        <p className="font-wide text-xl font-extrabold">Otkazati termin?</p>
        {booking && (
          <p className="mt-2 text-ink/75">
            {booking.courtName}, {hhmm(booking.start)}–{hhmm(booking.start + booking.duration)}. Termin postaje slobodan za druge.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-4 py-2 text-sm font-semibold">
            Ne, ostavi
          </button>
          <button type="button" disabled={busy} onClick={cancel} className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-chalk disabled:opacity-50">
            Da, otkaži
          </button>
        </div>
      </dialog>
    </main>
  );
}
