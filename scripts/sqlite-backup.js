"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync, backup } = require("node:sqlite");

function verifyDatabase(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    if (db.prepare("PRAGMA quick_check").get().quick_check !== "ok")
      throw new Error("SQLite integrity check failed");
    return { matches: db.prepare("SELECT count(*) AS count FROM matches").get().count,
      leaderboard: db.prepare(`SELECT count(*) AS count FROM match_players p
        JOIN matches m ON m.match_id=p.match_id WHERE m.eligible=1`).get().count };
  } finally { db.close(); }
}

function removeSidecars(filename) {
  for (const suffix of ["-wal", "-shm"])
    if (fs.existsSync(filename + suffix)) fs.unlinkSync(filename + suffix);
}

async function backupDatabase(source, destination) {
  if (!fs.existsSync(source) || fs.existsSync(destination) ||
      path.resolve(source) === path.resolve(destination))
    throw new Error("Source missing or backup already exists");
  const temporary = path.join(path.dirname(destination),
    `.${path.basename(destination)}.${crypto.randomUUID()}.tmp`);
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, temporary);
    const result = verifyDatabase(temporary);
    removeSidecars(temporary);
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, destination);
    return result;
  } finally {
    db.close();
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    removeSidecars(temporary);
  }
}

function restoreDatabase(source, destination) {
  if (!fs.existsSync(source) || [destination, `${destination}-wal`,
    `${destination}-shm`].some((file) => fs.existsSync(file)))
    throw new Error("Backup missing or restore destination already exists");
  const result = verifyDatabase(source);
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(destination, 0o600);
  return result;
}

if (require.main === module) {
  const [command, source, destination] = process.argv.slice(2);
  (async () => {
    if (command === "verify" && source && !destination)
      return verifyDatabase(source);
    if (command === "backup" && source && destination)
      return backupDatabase(source, destination);
    if (command === "restore" && source && destination)
      return restoreDatabase(source, destination);
    throw new Error("Usage: node scripts/sqlite-backup.js backup|restore SOURCE DESTINATION, or verify FILE");
  })().then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { backupDatabase, restoreDatabase, verifyDatabase };
