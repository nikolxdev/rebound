const HORIZON: Record<string, string> = {
  morava: "M0 46 C40 38 70 54 110 46 S180 38 220 46 S290 54 320 46 V60 H0Z",
  ovcar: "M0 52 L60 30 L95 40 L140 14 L190 38 L240 26 L320 50 V60 H0Z",
  kablar: "M0 54 L50 40 L90 18 L120 30 L165 8 L215 34 L270 28 L320 46 V60 H0Z",
  jelica: "M0 50 C60 44 90 22 150 20 C210 18 250 40 320 44 V60 H0Z",
};

export default function CourtMini({ slug, indoor, className = "" }: { slug: string; indoor: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <rect width="320" height="200" fill={indoor ? "#131d31" : "#1a2a44"} />
      {indoor ? (
        <g stroke="#2a3854" strokeWidth="3">
          {[30, 80, 130, 180, 230, 280].map((x) => (
            <path key={x} d={`M${x} 0 L${160 + (x - 160) * 1.6} 70`} />
          ))}
        </g>
      ) : (
        <path d={HORIZON[slug] || HORIZON.jelica} fill="#24365a" transform="translate(0 14)" />
      )}
      <polygon points="70,78 250,78 300,190 20,190" fill="#1f4fa3" />
      <g fill="none" stroke="#f4f1ea" strokeWidth="2">
        <polygon points="70,78 250,78 300,190 20,190" />
        <path d="M45 134 H275" strokeWidth="4" />
        <path d="M58 106 H262 M33 162 H287" />
        <path d="M160 106 V162" />
      </g>
      <path d="M70 78 L20 190 M250 78 L300 190" stroke="#a9c8ff" strokeOpacity="0.5" strokeWidth="6" />
      <circle cx="205" cy="118" r="5" fill="#e2f54b" />
    </svg>
  );
}
