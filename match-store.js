"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

class MatchStore {
  constructor(filename) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
    this.db.exec(fs.readFileSync(path.join(__dirname, "migrations/001_matches.sql"), "utf8"));
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)").run();
  }

  ready() {
    if (this.db.prepare("PRAGMA quick_check").get().quick_check !== "ok") return false;
    this.db.exec("BEGIN IMMEDIATE");
    this.db.exec("ROLLBACK");
    return true;
  }

  save(room, state, eligible, outcome = state.status) {
    const sorted = room.players.map((player, index) => ({ player,
      result: state.players[index] })).sort((a, b) =>
      b.result.score - a.result.score ||
      b.result.ownDelivered - a.result.ownDelivered ||
      b.result.relayed - a.result.relayed ||
      b.result.reputation - a.result.reputation ||
      a.result.nodeId - b.result.nodeId);
    const ranks = new Map(sorted.map((item, index) => [item.result.nodeId, index + 1]));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const inserted = this.db.prepare(`INSERT OR IGNORE INTO matches
        (match_id,room_id,seed,player_count,actions,engine_schema,delivered,outcome,eligible,completed_at,result_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(room.matchId, room.id, room.seed,
          room.players.length, room.history.join(","), state.schemaVersion,
          state.delivered, outcome, eligible ? 1 : 0,
          new Date().toISOString(), JSON.stringify(state));
      if (inserted.changes) {
        const statement = this.db.prepare(`INSERT INTO match_players
          (match_id,node_id,guest_id,name,score,own_delivered,relayed,reputation,rank)
          VALUES (?,?,?,?,?,?,?,?,?)`);
        room.players.forEach((player, index) => {
          const result = state.players[index];
          statement.run(room.matchId, result.nodeId, player.tokenHash, player.name,
            result.score, result.ownDelivered, result.relayed, result.reputation,
            ranks.get(result.nodeId));
        });
      }
      this.db.exec("COMMIT");
      return Boolean(inserted.changes);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  leaderboard() {
    return this.db.prepare(`SELECT p.name, p.score, p.own_delivered AS ownDelivered,
      p.relayed, p.reputation, p.rank, p.node_id AS nodeId,
      m.match_id AS matchId, m.completed_at AS completedAt
      FROM match_players p JOIN matches m ON m.match_id=p.match_id
      WHERE m.eligible=1 ORDER BY p.score DESC, p.own_delivered DESC,
      p.relayed DESC, p.reputation DESC, m.completed_at ASC, p.node_id ASC
      LIMIT 50`).all();
  }

  match(id) {
    const row = this.db.prepare("SELECT * FROM matches WHERE match_id=?").get(id);
    return row ? { ...row, result: JSON.parse(row.result_json) } : null;
  }
}
module.exports = { MatchStore };
