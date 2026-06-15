PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS killboard_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS killboard_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES killboard_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS killboard_sessions_user_id_idx ON killboard_sessions(user_id);
CREATE INDEX IF NOT EXISTS killboard_sessions_expires_at_idx ON killboard_sessions(expires_at);

CREATE TABLE IF NOT EXISTS killboard_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  character_name TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES killboard_users(id) ON DELETE CASCADE,
  UNIQUE(user_id, character_name)
);

CREATE INDEX IF NOT EXISTS killboard_members_user_id_idx ON killboard_members(user_id);
