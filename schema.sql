-- Stable data layer (built offline by the pipeline).

CREATE TABLE IF NOT EXISTS words (
  id       TEXT PRIMARY KEY,         -- stable word-sense id
  lemma    TEXT NOT NULL,            -- e.g. "Termin"
  article  TEXT,                     -- der/die/das, NULL for non-nouns
  plural   TEXT,                     -- NULL for non-nouns / uncountable
  pos      TEXT NOT NULL,            -- noun/verb/adj/adv/...
  english  TEXT NOT NULL,
  level    TEXT NOT NULL CHECK (level IN ('A1','A2','B1'))
);

CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,      -- e.g. "doctor", "flat_hunt"
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS word_activities (
  word_id     TEXT NOT NULL REFERENCES words(id)      ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  relevance   INTEGER NOT NULL CHECK (relevance BETWEEN 1 AND 3),
  PRIMARY KEY (word_id, activity_id)
);
-- Words with no row here are "core" (weil, schon, ...).

CREATE TABLE IF NOT EXISTS sentences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id     TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,  -- NULL = generic / core
  text        TEXT NOT NULL,
  english     TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('tatoeba','llm','goethe')),
  tatoeba_id  INTEGER                              -- source='tatoeba' only
);

CREATE INDEX IF NOT EXISTS idx_sentences_word_activity
  ON sentences(word_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_word_activities_activity
  ON word_activities(activity_id);

-- Runtime state (populated by the app).

CREATE TABLE IF NOT EXISTS user_state (
  id              INTEGER PRIMARY KEY CHECK (id = 1),   -- singleton per profile DB
  name            TEXT,                                 -- display name shown in UI
  level           TEXT CHECK (level IN ('A1','A2','B1')),
  swipe_count     INTEGER NOT NULL DEFAULT 0,
  drop_streak     INTEGER NOT NULL DEFAULT 0,           -- consecutive drops within current bucket
  level_bias      REAL NOT NULL DEFAULT 0.0,            -- raised by reflection on 'known' drops
  current_topic   TEXT REFERENCES activities(id),       -- active (topic, level) bucket
  cards_in_bucket INTEGER NOT NULL DEFAULT 0,           -- cards shown since entering current bucket
  affinity_below  REAL NOT NULL DEFAULT 1.0,            -- multiplier on prob of showing declared-1 cards
  affinity_above  REAL NOT NULL DEFAULT 1.0,            -- multiplier on prob of showing declared+1 cards
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_weights (
  activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
  weight      REAL NOT NULL DEFAULT 1.0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS swipes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id     TEXT NOT NULL REFERENCES words(id),
  activity_id TEXT REFERENCES activities(id),       -- NULL if drawn from core bucket
  sentence_id INTEGER REFERENCES sentences(id),
  action      TEXT NOT NULL CHECK (action IN ('keep','drop')),
  drop_reason TEXT CHECK (drop_reason IN ('known','uninteresting')),  -- set later by reflection
  swiped_at   TEXT NOT NULL DEFAULT (datetime('now')),
  planted_at  TEXT                                   -- NULL = in seed bag; set when the bag is planted
);

CREATE INDEX IF NOT EXISTS idx_swipes_word   ON swipes(word_id);
CREATE INDEX IF NOT EXISTS idx_swipes_action ON swipes(action);
CREATE INDEX IF NOT EXISTS idx_swipes_time   ON swipes(swiped_at);

-- Kept words the user marked "learned" in flashcards; dropped from the flashcard queue.
CREATE TABLE IF NOT EXISTS flashcard_learned (
  word_id    TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  learned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Words the user has marked (via reflection) as already known; filtered from the feed.
CREATE TABLE IF NOT EXISTS known_words (
  word_id TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  marked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Spaced-repetition state per planted word (Anki SM-2 variant).
-- A row exists only for words the user has reviewed at least once.
CREATE TABLE IF NOT EXISTS word_srs (
  word_id       TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  ease          REAL    NOT NULL DEFAULT 2.5,     -- Anki ease factor
  interval_days REAL    NOT NULL DEFAULT 0,       -- current interval in days
  reps          INTEGER NOT NULL DEFAULT 0,       -- successful reviews in a row
  lapses        INTEGER NOT NULL DEFAULT 0,
  state         TEXT    NOT NULL DEFAULT 'learning'
                CHECK (state IN ('learning','review','relearning','graduated')),
  due_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  last_grade    INTEGER,                           -- 1=again, 2=hard, 3=good, 4=easy
  last_review_at TEXT,
  production TEXT
);
CREATE INDEX IF NOT EXISTS idx_word_srs_due ON word_srs(due_at);

-- Audit log of every review grading.
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id    TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  grade      INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
  track TEXT NOT NULL DEFAULT 'recognition' CHECK (track IN ('recognition','production')),
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_word ON reviews(word_id);
