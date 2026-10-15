import { openStore } from '../src/store.js';
const [command, source, destination] = process.argv.slice(2);
if (!['migrate', 'backup'].includes(command) || !source || !destination) {
  console.error('Usage: node scripts/database.js migrate legacy.json new.sqlite | backup source.sqlite backup.sqlite');
  process.exitCode = 1;
} else {
  let store;
  try {
    const { default: fs } = await import('node:fs');
    if (!fs.existsSync(source)) throw new Error('Source does not exist');
    if (fs.existsSync(destination)) throw new Error('Destination already exists; choose a new path');
    store = openStore(command === 'migrate' ? destination : source);
    if (command === 'migrate') console.log('Migrated record counts:', store.importJSON(source));
    else { store.backup(destination); console.log('Backup created'); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { store?.close(); }
}
