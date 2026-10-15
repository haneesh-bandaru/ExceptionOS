# Local operations and deployment gates

## Runtime and data

Use Node.js 22.13+ and `npm start`. For browser test dependencies use `npm ci` and `npx playwright install chromium`. The committed npm lockfile is authoritative.

Default startup creates `data/local.sqlite`. If it is new and `data/local.json` exists, startup imports the legacy records in a transaction and keeps the JSON original. A failed import removes the newly created database and stops startup. Do not run simultaneous first-start migrations; initialize once before starting workers.

For a custom legacy database, stop the old server and run:

```sh
npm run db:migrate -- /absolute/path/legacy.json /absolute/path/new.sqlite
EXCEPTIONOS_DB=/absolute/path/new.sqlite npm start
```

Migration refuses an existing destination. Inspect the reported collection counts, sign in, check existing cases, then switch the configured database path. The source file is not modified. Invalid relationships or duplicate records abort the entire import; repair a copy of the source and retry to a fresh destination. Back up valuable data before any migration.

## Backup and restore

```sh
npm run db:backup -- /absolute/path/local.sqlite /absolute/path/backup.sqlite
```

The backup command uses SQLite's consistent `VACUUM INTO` snapshot and refuses to overwrite a destination. Backup permissions are owner-only. Backups include account hashes, sessions, and private records; restrict access and encrypt off-machine storage.

To restore, stop the server and point `EXCEPTIONOS_DB` at a copy of the backup, preserving the original current database. Start locally, verify account access and case counts, and check deletion behavior before resuming use. The automated recovery test opens a backup and compares its records with the source.

Retained JSON originals and backups still contain old data after account deletion. Define an explicit retention/deletion policy. Never restore a stale JSON original automatically after a deployment has moved to SQLite. Scheduled backups, off-host storage, retention enforcement, and disaster-recovery exercises are not implemented.

## Anna verification

```sh
npm run anna:validate
```

This pins official CLI 0.1.58 and runs strict validation from `anna/`. Validation passed on October 14, 2026, using dispatcher schema 0.26.0. The CLI may require downloading packages and writing its cache. It does not publish the app.

For actual host verification, follow the [official Anna guide](https://forum.anna.partners/t/build-on-anna-101/228): install uv, configure a local agent, run the CLI doctor, authorize a developer session, and run the development harness. No authenticated host test or publication has been performed.

## Deployment gates

Do not expose local admin bootstrapping publicly. Implement verified identity, role management, account recovery, session security, audit events, and durable throttling first. Serve behind HTTPS, configure secrets outside source control, test realistic workloads, monitor failures, and establish backup recovery. Whole-state synchronous SQLite transactions suit a small prototype; targeted queries and load tests are needed before scaling. Multiple app instances still have separate in-memory rate limits.

AI keys are optional. No live provider has been evaluated; only use consented test cases when validating one. Hackathon eligibility and submission requirements remain unconfirmed.
