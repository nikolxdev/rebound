# Rebound

Booking app for a made-up padel club in Čačak. Pick a court, a day and a time, get a booking code and a page where you can view or cancel it. Staff log in to see the day, move bookings around and block courts.

**Live:** https://nikolxdev.github.io/rebound/

## Stack

- `web/` – React, TypeScript, Tailwind CSS, GSAP (Vite)
- `api/` – Node.js, Express, PostgreSQL (plain SQL with `pg`), Zod
- Emails through Resend. Without a verified domain Resend only delivers to my own address, so I get a mail for every booking and guests get their code on screen. The API runs on Render, the database on Neon, the site on GitHub Pages.

Two bookings on the same court can't overlap. That's checked in the database itself with an exclusion constraint, so it holds even if two people click at the same moment.

## Run it

You need Node 22 and a PostgreSQL database.

```
cp api/.env.example api/.env      # fill in DATABASE_URL
npm run install:all
npm --prefix api run create-admin
npm run dev:api
npm run dev:web
```

The site opens on http://localhost:5173, the API on http://localhost:8787. `npm --prefix api run seed:demo` adds a week of fake bookings.

## Tests

```
TEST_DATABASE_URL=postgres://... npm test
```

API tests run against a real Postgres database (it gets wiped), they also run in GitHub Actions on every push.

## License

© 2026 Nikola Vojvodić. All rights reserved. The code is public so it can be read and evaluated as part of my portfolio; it is not open source. See [LICENSE](LICENSE) for what is and isn't allowed.
