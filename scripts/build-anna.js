import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'anna/src');
const target = path.join(root, 'anna/bundle');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
for (const name of fs.readdirSync(source)) fs.copyFileSync(path.join(source, name), path.join(target, name));
console.log('Anna-native bundle built. No backend, credentials, or user data are bundled.');
