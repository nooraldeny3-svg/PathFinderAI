-- PathFinder AI database schema

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment answers: major, graduation year and career interests
CREATE TABLE IF NOT EXISTS profiles (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  major           TEXT NOT NULL,
  graduation_year INTEGER,
  interests       TEXT[] NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  category          TEXT NOT NULL,
  learning_resource TEXT
);

-- Self-assessed skill level, 1 (beginner) to 5 (expert)
CREATE TABLE IF NOT EXISTS user_skills (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level    SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS careers (
  id             SERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  field          TEXT NOT NULL,
  related_majors TEXT[] NOT NULL DEFAULT '{}',
  interests      TEXT[] NOT NULL DEFAULT '{}'
);

-- importance: 1 (nice to have) .. 3 (essential); min_level: expected level for an entry role
CREATE TABLE IF NOT EXISTS career_skills (
  career_id  INTEGER NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  skill_id   INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  importance SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 3),
  min_level  SMALLINT NOT NULL CHECK (min_level BETWEEN 1 AND 5),
  PRIMARY KEY (career_id, skill_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL CHECK (source IN ('ai', 'rules')),
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id                SERIAL PRIMARY KEY,
  recommendation_id INTEGER NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  career_id         INTEGER NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recommendation_id, career_id)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(user_id, created_at DESC);
