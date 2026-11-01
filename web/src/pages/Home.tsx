import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Booking from "../components/Booking";
import CourtIntro from "../components/CourtIntro";
import Courts from "../components/Courts";
import Footer from "../components/Footer";
import { WAKING, useAvailability, useClub, useSlow } from "../lib/data";
import { useReducedMotion } from "../lib/motion";
import { rsd } from "../lib/time";

export default function Home() {
  const { court } = useParams();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { config, courts, error } = useClub();
  const { data: today } = useAvailability(config?.today ?? null);
  const slow = useSlow(!config && !error);
  const hero = useRef<HTMLDivElement>(null);
  const bookingRef = useRef<HTMLElement>(null);
  const selected = courts.some((c) => c.slug === court) ? court! : null;

  useGSAP(
    () => {
      if (reduced) return;
      gsap.from(".hero-line", { yPercent: 110, duration: 0.9, stagger: 0.08, ease: "power4.out", delay: 1.6 });
      gsap.from(".hero-fade", { opacity: 0, duration: 0.6, delay: 2.3 });
    },
    { scope: hero, dependencies: [reduced] },
  );

  useEffect(() => {
    if (court && selected) bookingRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [court, selected, reduced]);

  const select = (slug: string) => navigate(`/teren/${slug}`, { replace: Boolean(court) });

  return (
    <>
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-10">
        <a href="#/" className="font-wide text-xl font-extrabold tracking-tight">
          REBOUND
        </a>
        <nav aria-label="Glavna" className="flex items-center gap-5 text-sm">
          <a href="#tereni" onClick={(e) => { e.preventDefault(); document.getElementById("tereni")?.scrollIntoView({ behavior: "smooth" }); }} className="hidden hover:text-ball sm:inline">
            Tereni
          </a>
          <a href="#cene" onClick={(e) => { e.preventDefault(); document.getElementById("cene")?.scrollIntoView({ behavior: "smooth" }); }} className="hidden hover:text-ball sm:inline">
            Cene
          </a>
          <button type="button" onClick={() => bookingRef.current?.scrollIntoView({ behavior: "smooth" })} className="rounded-full border border-chalk/30 px-4 py-1.5 hover:border-ball hover:text-ball">
            Rezerviši
          </button>
        </nav>
      </header>

      <main>
        <section ref={hero} className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden px-5 pb-12 pt-24 md:px-10 lg:pb-16">
          <div className="pointer-events-none absolute inset-x-0 top-16 lg:left-auto lg:right-[4%] lg:top-[7%] lg:w-[56%]">
            <CourtIntro reduced={reduced} />
          </div>
          <div className="relative max-w-6xl lg:mx-auto lg:w-full">
            <h1 className="font-wide text-[10vw] font-black leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="block overflow-hidden"><span className="hero-line block"><span className="inline-block">Teren je</span> <span className="inline-block">tvoj</span></span></span>
              <span className="block overflow-hidden"><span className="hero-line block text-ball"><span className="inline-block">od 8</span> <span className="inline-block">do 23.</span></span></span>
            </h1>
            <div className="hero-fade">
              <p className="mt-6 max-w-md text-lg text-chalk/85">
                Četiri padel terena na keju Morave u Čačku. Izabereš teren i sat, dobiješ kod rezervacije, plaćaš na recepciji.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <button type="button" onClick={() => bookingRef.current?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-ball px-6 py-3 font-semibold text-ink transition-transform hover:-translate-y-0.5">
                  Rezerviši teren
                </button>
                <p className="max-w-[16rem] text-xs leading-snug text-muted">
                  <em className="not-italic text-chalk/80">Rebound</em>: lopta se odbije od zadnjeg stakla i poen se nastavlja.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Courts courts={courts} config={config} today={today} reduced={reduced} onPick={select} />

        <section id="rezervacija" ref={bookingRef} className="scroll-mt-4 bg-ink-2 px-5 py-20 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-wide text-[2rem] font-extrabold leading-none sm:text-4xl md:text-6xl">Rezervacija</h2>
              <p className="max-w-xs text-sm text-muted">Termini su otvoreni za danas i naredne dve nedelje.</p>
            </div>
            {error && <p role="alert" className="rounded-sm bg-clay/20 px-4 py-3">{error}</p>}
            {config && courts.length > 0 && <Booking config={config} courts={courts} selected={selected} onSelect={select} reduced={reduced} />}
            {!config && !error && <p className="text-muted" aria-live="polite">{slow ? WAKING : "Učitavam termine…"}</p>}
          </div>
        </section>

        <section id="cene" className="bg-paper px-5 py-20 text-ink md:px-10">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1fr_1.3fr]">
            <h2 className="font-wide text-[2rem] font-extrabold leading-none sm:text-4xl md:text-6xl">Cene</h2>
            <div>
              <table className="w-full text-left">
                <caption className="sr-only">Cena terena po satu</caption>
                <tbody className="divide-y divide-ink/15">
                  <tr>
                    <th scope="row" className="py-4 pr-4 font-normal">Radnim danima do 16 h</th>
                    <td className="whitespace-nowrap py-4 text-right font-narrow text-2xl font-black sm:text-3xl">{rsd(config?.prices.offPeak ?? 2400)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-4 pr-4 font-normal">Radnim danima od 16 h, vikendom ceo dan</th>
                    <td className="whitespace-nowrap py-4 text-right font-narrow text-2xl font-black sm:text-3xl">{rsd(config?.prices.peak ?? 3200)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-6 max-w-lg text-ink/75">
                Cena je za ceo teren i jedan sat, bez obzira da li igrate u dvoje ili u četvoro. Ako termin pređe 16 h, svakih pola sata se računa po svojoj ceni.
                Reketi i loptice mogu da se iznajme na recepciji.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
