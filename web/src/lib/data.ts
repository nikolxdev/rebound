import { useEffect, useState } from "react";
import { api, type Availability, type Config, type Court } from "./api";

export const COURT_NOTES: Record<string, string> = {
  morava: "Zatvoren, grejan zimi. Najbliži recepciji.",
  ovcar: "Zatvoren, staklo sa sve četiri strane.",
  kablar: "Otvoren, pogled na Kablar. Radi kad je suvo.",
  jelica: "Otvoren, najmirniji ugao kluba.",
};

export function useClub() {
  const [config, setConfig] = useState<Config | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api<Config>("/api/config"), api<Court[]>("/api/courts")])
      .then(([c, list]) => {
        if (!alive) return;
        setConfig(c);
        setCourts(list);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  return { config, courts, error };
}

const availability = new Map<string, Availability>();
const pending = new Map<string, Promise<Availability>>();

function loadAvailability(date: string) {
  const running = pending.get(date);
  if (running) return running;
  const request = api<Availability>(`/api/availability?date=${date}`)
    .then((d) => {
      availability.set(date, d);
      return d;
    })
    .finally(() => pending.delete(date));
  pending.set(date, request);
  return request;
}

export function prefetchAvailability(dates: string[]) {
  for (const date of dates) {
    if (!availability.has(date)) loadAvailability(date).catch(() => {});
  }
}

export function useAvailability(date: string | null, refresh = 0) {
  const [data, setData] = useState<Availability | null>(date ? availability.get(date) ?? null : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    const cached = availability.get(date);
    setData(cached ?? null);
    setLoading(!cached);
    loadAvailability(date)
      .then((d) => alive && setData(d))
      .catch(() => alive && !cached && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date, refresh]);

  return { data, loading };
}

export function useSlow(active: boolean, after = 3000) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setSlow(false);
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), after);
    return () => clearTimeout(timer);
  }, [active, after]);

  return slow;
}

export const WAKING = "Budim server. Posle pauze prvo učitavanje traje do pola minuta.";

export function freeHours(busy: { start: number; end: number }[], from: number, open: number, close: number) {
  let free = 0;
  for (let t = Math.max(open, Math.ceil(from / 30) * 30); t < close; t += 30) {
    if (!busy.some((b) => t < b.end && t + 30 > b.start)) free += 30;
  }
  return free / 60;
}
