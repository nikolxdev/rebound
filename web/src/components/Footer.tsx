import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-chalk/10 bg-ink px-5 py-12 text-sm text-muted md:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="font-wide text-2xl font-extrabold text-chalk">REBOUND</p>
          <p className="mt-3 max-w-xs">
            Rebound je izmišljen padel klub. Ovo je demo projekat: rezervacije rade, ali niko vas ne čeka na terenu.
          </p>
        </div>
        <div>
          <p className="text-chalk">Radno vreme</p>
          <p className="mt-2">Svaki dan 08–23 h</p>
          <p className="mt-4 text-chalk">Adresa</p>
          <p className="mt-2">Kej Morave, Čačak</p>
        </div>
        <div className="flex flex-col items-start">
          <a className="py-2 hover:text-chalk" href="https://github.com/nikolxdev/rebound" rel="noopener" target="_blank">
            Kod na GitHubu
          </a>
          <a className="py-2 hover:text-chalk" href="https://nikolxdev.github.io/" rel="author">
            Napravio Nikola Vojvodić
          </a>
          <Link className="py-2 hover:text-chalk" to="/admin">
            Za osoblje
          </Link>
        </div>
      </div>
    </footer>
  );
}
