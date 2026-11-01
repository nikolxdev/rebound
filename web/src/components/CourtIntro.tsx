import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useRef } from "react";

gsap.registerPlugin(MotionPathPlugin, useGSAP);

const X = 80;
const Y = 70;
const W = 840;
const H = 420;
const NET = X + W / 2;
const SERVICE = 292;
const GLASS = 168;
const RALLY = "M230,372 Q470,250 716,334 L902,262 Q650,150 336,214";

export default function CourtIntro({ reduced }: { reduced: boolean }) {
  const root = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const lines = gsap.utils.toArray<SVGGeometryElement>(".draw", root.current);
      if (reduced) {
        gsap.set(".light", { opacity: 1 });
        gsap.set(".turf", { opacity: 1 });
        gsap.set(".ball", { opacity: 1, attr: { transform: "translate(336 214)" } });
        gsap.set(".trail", { opacity: 0.9 });
        return;
      }
      lines.forEach((el) => {
        const len = el.getTotalLength() + 2;
        gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
      });
      const trail = root.current!.querySelector<SVGPathElement>(".trail")!;
      const trailLen = trail.getTotalLength() + 2;
      gsap.set(trail, { strokeDasharray: trailLen, strokeDashoffset: trailLen });

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.to(lines, { strokeDashoffset: 0, duration: 0.9, stagger: 0.05 })
        .to(".light", { opacity: 1, duration: 0.25, stagger: 0.22, ease: "steps(3)" }, "-=0.2")
        .to(".turf", { opacity: 1, duration: 0.8 }, "<0.2")
        .set(".ball", { opacity: 1 })
        .set(trail, { opacity: 0.9 }, "<")
        .fromTo(
          trail,
          { strokeDashoffset: trailLen },
          { strokeDashoffset: 0, duration: 1.5, ease: "none" },
          "<",
        )
        .to(".ball", { duration: 1.5, ease: "none", motionPath: { path: RALLY } }, "<")
        .to(".ball-core", { scale: 1.7, duration: 0.45, yoyo: true, repeat: 1, ease: "sine.inOut", transformOrigin: "50% 50%" }, "<")
        .to(".wall-hit", { opacity: 1, scale: 1.6, duration: 0.2, transformOrigin: "50% 50%" }, "<0.95")
        .to(".wall-hit", { opacity: 0, duration: 0.4 });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <svg ref={root} viewBox="0 0 1000 560" overflow="visible" className="h-auto w-full" role="img" aria-label="Padel teren odozgo: lopta prelazi mrežu, odbija se od zadnjeg stakla i vraća se">
      <defs>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#fff3c4" stopOpacity="0.32" />
          <stop offset="0.35" stopColor="#fff3c4" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="turf" x1="0" x2="1">
          <stop offset="0" stopColor="#173b7a" />
          <stop offset="0.5" stopColor="#1f4fa3" />
          <stop offset="1" stopColor="#173b7a" />
        </linearGradient>
      </defs>

      <rect className="turf" x={X} y={Y} width={W} height={H} fill="url(#turf)" opacity="0.12" />

      {[
        [X, Y - 22], [X + W, Y - 22], [X, Y + H + 22], [X + W, Y + H + 22],
      ].map(([cx, cy], i) => (
        <g key={i} className="light" opacity="0">
          <circle cx={cx} cy={cy} r="380" fill="url(#glow)" />
          <circle cx={cx} cy={cy} r="7" fill="#fffbe8" />
        </g>
      ))}

      <g fill="none" stroke="#f4f1ea" strokeLinecap="round">
        <rect className="draw" x={X} y={Y} width={W} height={H} strokeWidth="3" />
        <path className="draw" d={`M${NET} ${Y - 6}V${Y + H + 6}`} strokeWidth="5" />
        <path className="draw" d={`M${NET - SERVICE} ${Y}V${Y + H}M${NET + SERVICE} ${Y}V${Y + H}`} strokeWidth="2.5" />
        <path className="draw" d={`M${NET - SERVICE} ${Y + H / 2}H${NET + SERVICE}`} strokeWidth="2.5" />
        <path
          className="draw"
          d={`M${X} ${Y}h${GLASS}M${X + W - GLASS} ${Y}h${GLASS}M${X} ${Y + H}h${GLASS}M${X + W - GLASS} ${Y + H}h${GLASS}M${X} ${Y}v${H}M${X + W} ${Y}v${H}`}
          stroke="#a9c8ff"
          strokeOpacity="0.55"
          strokeWidth="10"
        />
      </g>

      <path className="trail" d={RALLY} fill="none" stroke="#e2f54b" strokeWidth="2.5" opacity="0" />
      <circle className="wall-hit" cx="902" cy="262" r="16" fill="none" stroke="#e2f54b" strokeWidth="3" opacity="0" />
      <g className="ball" opacity="0" transform="translate(230 372)">
        <ellipse cx="6" cy="9" rx="10" ry="5" fill="#000" opacity="0.35" />
        <circle className="ball-core" r="9" fill="#e2f54b" />
      </g>
    </svg>
  );
}
