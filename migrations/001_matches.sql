CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS matches (
  match_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  actions TEXT NOT NULL,
  engine_schema INTEGER NOT NULL,
  delivered INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  eligible INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  result_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL REFERENCES matches(match_id),
  node_id INTEGER NOT NULL,
  guest_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  own_delivered INTEGER NOT NULL,
  relayed INTEGER NOT NULL,
  reputation REAL NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY(match_id, node_id)
);
