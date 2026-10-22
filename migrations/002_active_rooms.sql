CREATE TABLE IF NOT EXISTS active_rooms (
  room_id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE,
  seed INTEGER NOT NULL,
  players_json TEXT NOT NULL,
  state_json TEXT NOT NULL,
  history TEXT NOT NULL,
  turn_seconds REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('playing','interrupted')),
  updated_at TEXT NOT NULL
);
