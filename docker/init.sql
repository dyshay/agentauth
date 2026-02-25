CREATE TABLE IF NOT EXISTS agentauth_challenges (
  id         TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agentauth_expires
  ON agentauth_challenges (expires_at);

-- Leaderboard tables
CREATE TABLE IF NOT EXISTS agentauth_leaderboard (
  family      TEXT PRIMARY KEY,
  provider    TEXT NOT NULL DEFAULT '',
  overall     REAL NOT NULL DEFAULT 0,
  reasoning   REAL NOT NULL DEFAULT 0,
  execution   REAL NOT NULL DEFAULT 0,
  autonomy    REAL NOT NULL DEFAULT 0,
  speed       REAL NOT NULL DEFAULT 0,
  consistency REAL NOT NULL DEFAULT 0,
  challenges  INTEGER NOT NULL DEFAULT 0,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
