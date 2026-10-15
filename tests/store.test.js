import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore } from '../src/store.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exceptionos-store-'));
  const file = path.join(dir, 'db.sqlite');
  const stores = [];
  const open = () => { const store = openStore(file); stores.push(store); return store; };
  t.after(() => { for (const store of stores) store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { dir, file, open };
}
const user = { id: 'user-1', email: 'one@example.com', hash: 'test-only' };

test('failed mutation rolls back both persisted and visible state', t => {
  const x = fixture(t), store = x.open();
  store.mutate(d => d.users.push(user));
  assert.throws(() => store.mutate(d => { d.users[0].email = 'changed@example.com'; throw Error('abort'); }), /abort/);
  assert.equal(store.data.users[0].email, user.email);
  assert.equal(x.open().data.users[0].email, user.email);
});

test('constraints reject duplicate email and orphan records atomically', t => {
  const x = fixture(t), store = x.open();
  store.mutate(d => d.users.push(user));
  assert.throws(() => store.mutate(d => d.users.push({ ...user, id: 'user-2' })), /UNIQUE/);
  assert.throws(() => store.mutate(d => d.cases.push({ id: 'case-1', userId: 'missing' })), /FOREIGN KEY/);
  assert.equal(store.data.users.length, 1);
  assert.equal(store.data.cases.length, 0);
});

test('independent connections see committed changes and avoid lost writes', async t => {
  const x = fixture(t), a = x.open(), b = x.open();
  await a.serialized(d => d.users.push(user));
  await b.serialized(d => d.users.push({ ...user, id: 'user-2', email: 'two@example.com' }));
  assert.equal(a.data.users.length, 2);
  assert.equal(b.data.users.length, 2);
});

test('legacy migration preserves IDs, tolerates missing sources, and refuses overwrite', t => {
  const x = fixture(t), store = x.open();
  const source = path.join(x.dir, 'old.json');
  const legacy = { users: [user], sessions: [], cases: [{ id: 'case-1', userId: user.id }], knowledge: [] };
  const original = JSON.stringify(legacy);
  fs.writeFileSync(source, original);
  assert.deepEqual(store.importJSON(source), { users: 1, sessions: 0, cases: 1, knowledge: 0, sources: 0 });
  assert.equal(store.data.cases[0].id, 'case-1');
  assert.equal(fs.readFileSync(source, 'utf8'), original);
  assert.throws(() => store.importJSON(source), /empty/);
});

test('invalid migration leaves the destination empty', t => {
  const x = fixture(t), store = x.open();
  const source = path.join(x.dir, 'bad.json');
  fs.writeFileSync(source, JSON.stringify({ users: [user], cases: [{ id: 'case-1', userId: 'missing' }] }));
  assert.throws(() => store.importJSON(source), /FOREIGN KEY/);
  assert.equal(store.data.users.length, 0);
});

test('backup reopens with identical data and cannot overwrite another file', t => {
  const x = fixture(t), store = x.open();
  store.mutate(d => d.users.push(user));
  const destination = path.join(x.dir, 'backup.sqlite');
  store.backup(destination);
  const restored = openStore(destination);
  try { assert.deepEqual(restored.data, store.data); }
  finally { restored.close(); }
  assert.equal(fs.statSync(destination).mode & 0o777, 0o600);
  assert.throws(() => store.backup(destination), /EEXIST/);
});
