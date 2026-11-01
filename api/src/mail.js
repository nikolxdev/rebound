import { hhmm } from "./rules.js";

export function createMailer(env = process.env) {
  const key = env.RESEND_API_KEY;
  const from = env.MAIL_FROM || "Rebound <onboarding@resend.dev>";
  return async function send({ to, subject, text }) {
    if (!to) return;
    if (!key) {
      console.log(`[mail] to=${to} subject="${subject}"\n${text}\n`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) console.error(`[mail] failed ${res.status}: ${await res.text()}`);
  };
}

const niceDate = (date) => {
  const [y, m, d] = date.split("-");
  return `${+d}.${+m}.${y}.`;
};

export function confirmationMail(b, webUrl) {
  const link = `${webUrl}#/rezervacija/${b.code}?t=${b.token}`;
  return {
    to: b.email,
    subject: `Rezervacija ${b.code} – teren ${b.courtName}, ${niceDate(b.date)} u ${hhmm(b.start)}`,
    text: [
      `Zdravo ${b.name},`,
      "",
      `rezervisali ste teren ${b.courtName} za ${niceDate(b.date)} od ${hhmm(b.start)} do ${hhmm(b.start + b.duration)}.`,
      `Cena: ${b.price.toLocaleString("sr-RS")} RSD, plaća se na recepciji.`,
      "",
      `Kod rezervacije: ${b.code}`,
      `Pregled i otkazivanje (najkasnije 2 sata ranije): ${link}`,
      "",
      "Vidimo se na terenu,",
      "Rebound",
    ].join("\n"),
  };
}

export function ownerMail(b, kind, ownerEmail) {
  const what = kind === "cancel" ? "Otkazana rezervacija" : "Nova rezervacija";
  return {
    to: ownerEmail,
    subject: `${what}: ${b.courtName}, ${niceDate(b.date)} ${hhmm(b.start)}`,
    text: `${what} ${b.code}\n${b.courtName}, ${niceDate(b.date)} ${hhmm(b.start)}–${hhmm(b.start + b.duration)}\n${b.name}, ${b.phone}, ${b.email}\n${b.price} RSD`,
  };
}
