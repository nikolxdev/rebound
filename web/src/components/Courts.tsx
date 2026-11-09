import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import type { Availability, Config, Court } from "../lib/api";
import { COURT_NOTES, freeHours } from "../lib/data";
import { belgradeNowMinutes } from "../lib/time";
import CourtMini from "./CourtMini";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Props = {
  courts: Court[];
  config: Config | null;
  today: Availability | null;
  reduced: boolean;
  onPick: (slug: string) => void;
};

export default function Courts({ courts, config, today, reduced, onPick }: Props) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reduced || !courts.length) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const distance = () => track.current!.scrollWidth - window.innerWidth;
        gsap.to(track.current, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        gsap.utils.toArray<HTMLElement>(".court-art", track.current).forEach((art) => {
          gsap.fromTo(art, { scale: 1.12 }, { scale: 1, ease: "none", scrollTrigger: { trigger: section.current, start: "top top", end: () => `+=${distance()}`, scrub: true } });
        });
      });
      return () => mm.revert();
    },
    { scope: section, dependencies: [reduced, courts.length] },
  );

  const nowMin = config ? belgradeNowMinutes(config.now) : 0;

  return (
    <section id="tereni" ref={section} className="overflow-hidden bg-ink py-20 lg:flex lg:h-screen lg:items-center lg:py-0">
      <div ref={track} className="flex snap-x snap-mandatory scroll-px-5 gap-6 overflow-x-auto px-5 no-scrollbar lg:w-max lg:snap-none lg:gap-10 lg:overflow-visible lg:px-[8vw]">
        <div className="flex w-[78vw] shrink-0 snap-start flex-col justify-center sm:w-[50vw] lg:w-[30vw]">
          <h2 className="font-wide text-[2rem] font-extrabold leading-[0.95] sm:text-4xl lg:text-6xl">Četiri terena, četiri imena.</h2>
          <p className="mt-5 max-w-sm text-muted">
            Svaki teren nosi ime po onome što se vidi iz Čačka: reka i tri planine. Dva su pod krovom, dva napolju.
          </p>
        </div>

        {courts.map((court, i) => {
          const busy = today?.courts.find((c) => c.court === court.slug)?.busy || [];
          const hours = config ? freeHours(busy, nowMin, config.open, config.close) : null;
          return (
            <article key={court.slug} className="flex w-[78vw] shrink-0 snap-start flex-col sm:w-[50vw] lg:w-[38vw]">
              <div className="overflow-hidden rounded-sm">
                <CourtMini slug={court.slug} indoor={court.indoor} className="court-art h-auto w-full" />
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-4">
                <h3 className="font-name text-5xl font-extrabold uppercase leading-none lg:text-7xl">{court.name}</h3>
                <span className="font-narrow text-xl text-muted">0{i + 1}</span>
              </div>
              <p className="mt-3 text-chalk/80">{COURT_NOTES[court.slug]}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <button
                  type="button"
                  onClick={() => onPick(court.slug)}
                  className="rounded-full bg-ball px-5 py-2.5 font-semibold text-ink transition-transform hover:-translate-y-0.5"
                >
                  Rezerviši {court.name}
                </button>
                <span className="text-sm text-muted">
                  {hours === null ? " " : hours > 0 ? `Danas još ${hours} h slobodno` : "Danas popunjen"}
                </span>
              </div>
            </article>
          );
        })}
        <div className="hidden w-[8vw] shrink-0 lg:block" />
      </div>
    </section>
  );
}
