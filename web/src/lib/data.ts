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

export function useAvailability(date: string | null, refresh = 0) {
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setLoading(true);
    api<Availability>(`/api/availability?date=${date}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date, refresh]);

  return { data, loading };
}

export function freeHours(busy: { start: number; end: number }[], from: number, open: number, close: number) {
  let free = 0;
  for (let t = Math.max(open, Math.ceil(from / 30) * 30); t < close; t += 30) {
    if (!busy.some((b) => t < b.end && t + 30 > b.start)) free += 30;
  }
  return free / 60;
}
