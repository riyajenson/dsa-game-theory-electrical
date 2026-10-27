"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MatchStore } = require("../match-store");
const { backupDatabase, restoreDatabase, verifyDatabase } = require("../scripts/sqlite-backup");

test("online WAL backup restores completed matches and leaderboard", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "signalbound-backup-"));
  const source = path.join(directory, "live.sqlite");
  const snapshot = path.join(directory, "snapshot.sqlite");
  const restored = path.join(directory, "restore.sqlite");
  const store = new MatchStore(source);
  t.after(() => { store.db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const room = { id: "ABC234", matchId: "abc-match", seed: 17, history: ["TR"],
    players: [{ name: "Ada", tokenHash: "a" }, { name: "Lin", tokenHash: "b" }] };
  const state = { schemaVersion: 1, status: "won", delivered: 6,
    players: [{ nodeId: 1, score: 50, ownDelivered: 2, relayed: 0, reputation: 0.5 },
      { nodeId: 2, score: 40, ownDelivered: 0, relayed: 2, reputation: 0.7 }] };
  assert.equal(store.save(room, state, true), true);
  await backupDatabase(source, snapshot);
  assert.deepEqual(fs.readdirSync(directory).filter((name) =>
    name.startsWith(".snapshot.sqlite") || name.startsWith("snapshot.sqlite-")), []);
  assert.equal(verifyDatabase(snapshot).matches, 1);
  restoreDatabase(snapshot, restored);
  const recovered = new MatchStore(restored);
  assert.equal(recovered.match("abc-match").eligible, 1);
  assert.equal(recovered.leaderboard().length, 2);
  assert.equal(recovered.save(room, state, true), false);
  recovered.db.close();
  assert.throws(() => restoreDatabase(snapshot, restored), /already exists/i);
});
