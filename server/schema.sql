-- Esquema PostgreSQL para la versión con servidor (Node.js + PostgreSQL).
-- La versión actual guarda los datos en el navegador; este esquema replica
-- las mismas entidades para migrar sin cambiar el modelo de datos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,              -- argon2id o bcrypt, nunca en claro
  institution   text,
  semester      text,
  role          text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE species (
  id              text PRIMARY KEY,         -- 'dog', 'cat', ...
  name            text NOT NULL,
  scientific_name text NOT NULL,
  available       boolean NOT NULL DEFAULT false
);

CREATE TABLE structures (
  species_id     text NOT NULL REFERENCES species(id),
  id             text NOT NULL,             -- 'femur'
  latin_name     text NOT NULL,
  name           text NOT NULL,
  common_name    text,
  system         text NOT NULL,
  classification text NOT NULL,
  region         text NOT NULL,
  level          text NOT NULL CHECK (level IN ('basico', 'intermedio', 'avanzado')),
  bilateral      boolean NOT NULL DEFAULT false,
  sex            text CHECK (sex IN ('male', 'female')),
  content        jsonb NOT NULL,            -- descripción, función, relaciones, clínica, referencias...
  review_status  text NOT NULL DEFAULT 'borrador' CHECK (review_status IN ('borrador', 'revisado')),
  reviewed_by    uuid REFERENCES users(id),
  reviewed_at    timestamptz,
  PRIMARY KEY (species_id, id)
);

CREATE TABLE models (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id  text NOT NULL REFERENCES species(id),
  label       text NOT NULL,
  url         text NOT NULL,                -- almacenamiento de objetos / CDN
  mesh_map    jsonb NOT NULL DEFAULT '{}',
  transform   jsonb,
  license     text NOT NULL,
  validated   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id   text NOT NULL REFERENCES species(id),
  type         text NOT NULL CHECK (type IN ('multiple', 'truefalse', 'identify3d', 'match', 'fill')),
  topic        text NOT NULL,
  level        text NOT NULL,
  structure_id text,
  body         jsonb NOT NULL,              -- enunciado, opciones, respuesta, explicación
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quiz_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id   text NOT NULL REFERENCES species(id),
  title        text NOT NULL,
  mode         text NOT NULL,
  practical    boolean NOT NULL,
  config       jsonb NOT NULL,
  duration_sec integer NOT NULL,
  total        integer NOT NULL,
  correct      integer NOT NULL,
  score_pct    numeric(5,1) NOT NULL,
  grade        numeric(2,1) NOT NULL,
  topics       jsonb NOT NULL,
  items        jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON quiz_attempts (user_id, created_at DESC);

CREATE TABLE structure_views (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id   text NOT NULL,
  structure_id text NOT NULL,
  count        integer NOT NULL DEFAULT 1,
  last_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, species_id, structure_id)
);

CREATE TABLE study_time (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     date NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE favorites (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id   text NOT NULL,
  structure_id text NOT NULL,
  PRIMARY KEY (user_id, species_id, structure_id)
);

CREATE TABLE bookmarks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id   text NOT NULL,
  structure_id text NOT NULL,
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guided_progress (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id text NOT NULL,
  step_id    text NOT NULL,
  done_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, species_id, step_id)
);
