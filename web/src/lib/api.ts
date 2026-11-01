export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8787").replace(/\/$/, "");

export type Court = { slug: string; name: string; indoor: boolean };
export type Config = {
  open: number;
  close: number;
  step: number;
  durations: number[];
  daysAhead: number;
  prices: { offPeak: number; peak: number };
  peakFrom: number;
  cancelBefore: number;
  today: string;
  now: string;
};
export type Busy = { start: number; end: number };
export type Availability = { date: string; courts: { court: string; busy: Busy[] }[] };
export type Booking = {
  id?: number;
  code: string;
  court: string;
  courtName: string;
  date: string;
  start: number;
  duration: number;
  name: string;
  email?: string;
  phone?: string;
  price: number;
  status: "confirmed" | "cancelled";
  token?: string;
};
export type Block = { id: number; court: string; date: string; start: number; duration: number; reason: string };

const MESSAGES: Record<string, string> = {
  taken: "Taj termin je već zauzet. Izaberi drugi.",
  past: "Taj termin je već prošao.",
  closed: "Klub radi od 8 do 23 h, termin mora da se završi do 23 h.",
  too_far: "Rezervacije su otvorene za naredne dve nedelje.",
  bad_name: "Upiši ime i prezime.",
  bad_email: "Mejl adresa nije ispravna.",
  bad_phone: "Broj telefona nije ispravan.",
  too_late: "Rezervacija može da se otkaže najkasnije 2 sata pre početka. Pozovi recepciju.",
  not_found: "Rezervacija nije pronađena. Proveri link.",
  wrong_login: "Pogrešan mejl ili lozinka.",
  unauthorized: "Prijava je istekla. Prijavi se ponovo.",
  too_many_requests: "Previše pokušaja. Probaj ponovo za nekoliko minuta.",
  network: "Server ne odgovara. Ako je prvo otvaranje posle pauze, sačekaj pola minuta i probaj opet.",
};

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(MESSAGES[code] || "Nešto nije u redu. Probaj ponovo.");
    this.code = code;
    this.status = status;
  }
}

let adminToken: string | null = sessionStorage.getItem("rebound-admin");

export function setAdminToken(token: string | null) {
  adminToken = token;
  if (token) sessionStorage.setItem("rebound-admin", token);
  else sessionStorage.removeItem("rebound-admin");
}

export const hasAdminToken = () => Boolean(adminToken);

export async function api<T>(path: string, options: { method?: string; body?: unknown; admin?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.admin && adminToken) headers.authorization = `Bearer ${adminToken}`;
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("network", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && options.admin) setAdminToken(null);
    throw new ApiError(data.error || "server_error", res.status);
  }
  return data as T;
}
