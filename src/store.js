import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const collections = ['users', 'sessions', 'cases', 'knowledge', 'sources'];
const empty = () => Object.fromEntries(collections.map(name => [name, []]));

// Records retain their existing shape while SQLite enforces ownership and uniqueness.
// Whole-state writes suit this small prototype; large deployments need targeted queries.
export function openStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    fs.chmodSync(file, 0o600);
    db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
    `);
    const version = db.prepare('SELECT MAX(version) AS version FROM migrations').get().version || 0;
    if (version > 1) throw new Error('Database schema is newer than this application');
    if (!version) db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, payload TEXT NOT NULL);
      CREATE TABLE sessions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), payload TEXT NOT NULL);
      CREATE TABLE cases (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), payload TEXT NOT NULL);
      CREATE TABLE knowledge (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), case_id TEXT NOT NULL UNIQUE REFERENCES cases(id), payload TEXT NOT NULL);
      CREATE TABLE sources (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), case_id TEXT NOT NULL REFERENCES cases(id), payload TEXT NOT NULL);
      INSERT INTO migrations VALUES (1);
      COMMIT;
    `);
  } catch (error) { db.close(); throw error; }

  function read() {
    return Object.fromEntries(collections.map(name => [name,
      db.prepare(`SELECT payload FROM ${name} ORDER BY rowid`).all().map(row => JSON.parse(row.payload))]));
  }
  function write(data) {
    for (const name of [...collections].reverse()) db.exec(`DELETE FROM ${name}`);
    for (const user of data.users) db.prepare('INSERT INTO users VALUES (?, ?, ?)').run(user.id, user.email.toLowerCase(), JSON.stringify(user));
    for (const name of ['sessions', 'cases']) {
      const insert = db.prepare(`INSERT INTO ${name} VALUES (?, ?, ?)`);
      for (const record of data[name]) insert.run(name === 'sessions' ? record.token : record.id, record.userId, JSON.stringify(record));
    }
    for (const name of ['knowledge', 'sources']) {
      const insert = db.prepare(`INSERT INTO ${name} VALUES (?, ?, ?, ?)`);
      for (const record of data[name]) {
        const userId = name === 'knowledge' ? record.contributorId : record.userId;
        const caseId = name === 'knowledge' ? record.sourceCaseId : record.caseId;
        if (!data.cases.some(c => c.id === caseId && c.userId === userId)) throw new Error('Record owner does not match case owner');
        insert.run(record.id, userId, caseId, JSON.stringify(record));
      }
    }
  }
  function mutate(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const data = read();
      const result = fn(data);
      if (result && typeof result.then === 'function') throw new Error('Store callbacks must be synchronous');
      write(data);
      db.exec('COMMIT');
      return result;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return {
    get data() {
      db.exec('BEGIN');
      try { const data = read(); db.exec('COMMIT'); return data; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    mutate,
    async serialized(fn) { return mutate(fn); },
    importJSON(source) {
      const input = JSON.parse(fs.readFileSync(source, 'utf8'));
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid legacy database');
      const data = { ...empty(), ...input };
      for (const name of collections) if (!Array.isArray(data[name])) throw new Error(`Invalid collection: ${name}`);
      return mutate(current => {
        if (collections.some(name => current[name].length)) throw new Error('Migration destination must be empty');
        Object.assign(current, data);
        return Object.fromEntries(collections.map(name => [name, data[name].length]));
      });
    },
    backup(destination) {
      // Reserve the destination before writing so sensitive backup files are never world-readable.
      const fd = fs.openSync(destination, 'wx', 0o600);
      fs.closeSync(fd);
      try { db.prepare('VACUUM INTO ?').run(path.resolve(destination)); }
      catch (error) { fs.unlinkSync(destination); throw error; }
    },
    close() { db.close(); }
  };
}
