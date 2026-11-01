CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE courts (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  indoor      boolean NOT NULL,
  sort_order  int NOT NULL
);

INSERT INTO courts (slug, name, indoor, sort_order) VALUES
  ('morava', 'Morava', true, 1),
  ('ovcar',  'Ovčar',  true, 2),
  ('kablar', 'Kablar', false, 3),
  ('jelica', 'Jelica', false, 4);

CREATE TABLE bookings (
  id            serial PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  cancel_token  text NOT NULL,
  court_id      int NOT NULL REFERENCES courts(id),
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text NOT NULL,
  price_rsd     int NOT NULL,
  status        text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX bookings_court_time ON bookings (court_id, starts_at);

CREATE TABLE blocks (
  id         serial PRIMARY KEY,
  court_id   int NOT NULL REFERENCES courts(id),
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  reason     text NOT NULL DEFAULT '',
  CHECK (ends_at > starts_at),
  CONSTRAINT blocks_no_overlap EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
);

CREATE TABLE admins (
  id             serial PRIMARY KEY,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  admin_id    int NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
