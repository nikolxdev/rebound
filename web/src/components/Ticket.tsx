import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import type { Booking } from "../lib/api";
import { hhmm, niceDate, rsd } from "../lib/time";

export default function Ticket({ booking, reduced, children }: { booking: Booking; reduced: boolean; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reduced) return;
      gsap.fromTo(
        ref.current,
        { clipPath: "inset(0 0 100% 0)", y: -24 },
        { clipPath: "inset(0 0 0% 0)", y: 0, duration: 1.1, ease: "steps(9)" },
      );
    },
    { scope: ref, dependencies: [booking.code] },
  );

  const cancelled = booking.status === "cancelled";

  return (
    <div ref={ref} className="mx-auto w-full max-w-md text-ink">
      <div className="ticket-edge h-2" />
      <div className="bg-chalk px-7 pb-7 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-dashed border-ink/30 pb-4">
          <div>
            <p className="font-narrow text-xs uppercase tracking-[0.3em] text-ink/60">Rebound · Čačak</p>
            <p className="mt-1 font-wide text-xl font-extrabold sm:text-2xl">{cancelled ? "Otkazano" : "Rezervisano"}</p>
          </div>
          <p className="font-narrow text-3xl font-black tracking-wider" aria-label={`Kod rezervacije ${booking.code}`}>
            {booking.code}
          </p>
        </div>
        <dl className={`mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 ${cancelled ? "line-through opacity-60" : ""}`}>
          <dt className="text-ink/60">Teren</dt>
          <dd className="font-semibold">{booking.courtName}</dd>
          <dt className="text-ink/60">Dan</dt>
          <dd className="font-semibold first-letter:uppercase">{niceDate(booking.date)}</dd>
          <dt className="text-ink/60">Vreme</dt>
          <dd className="font-semibold">
            {hhmm(booking.start)}–{hhmm(booking.start + booking.duration)}
          </dd>
          <dt className="text-ink/60">Na ime</dt>
          <dd className="font-semibold">{booking.name}</dd>
          <dt className="text-ink/60">Cena</dt>
          <dd className="font-semibold">{rsd(booking.price)}, plaća se na recepciji</dd>
        </dl>
        {children}
      </div>
      <div className="ticket-edge h-2 rotate-180" />
    </div>
  );
}
