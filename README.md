# ExceptionOS v1.1.0 — review candidate

**First time here? Read [FRIEND_SETUP.md](FRIEND_SETUP.md)** for installation, your own Anna login, running in your browser, and a test walkthrough.

Paste any message that needs a reply — from a recruiter, school, landlord, office, or client. In one Anna run, ExceptionOS shows what they are asking for (quoted from the original) and drafts an editable reply. Haven't heard back? It drafts a polite follow-up. You send it yourself, record it, and choose a check-in. Bigger situations get an optional action plan. English and Simplified Chinese.

The submission product is a native Anna App. Anna supplies model inference, signed-in user storage, and the app window lifecycle. It has no separate login, backend, database, API key, or deployment requirement.

## Run the Anna app

Requires Node.js 22.13+, the Anna CLI, and `uv`/`uvx` on `PATH`.

```sh
npm install
npm run anna:validate
npm run anna:dev
# open http://localhost:5180
```

If `uvx` is installed in the temporary tool directory used during development:

```sh
PATH="/private/tmp/exceptionos-tools:$PATH" npm run anna:dev
```

## Verify

```sh
npm test
npm run test:e2e
npm run anna:validate
```

Review status, October 22, 2026:

- 58 unit, API, storage, safety, domain and translation-coverage tests pass.
- 13 browser scenarios cover the one-step quick start (including malformed-output retry and model failure), the no-reply follow-up route, the Chinese interface, reply chronology, proposals kept across navigation, dialog focus, resolved-goal locking, model/storage failures, persistence in a fresh browser, and mobile layout.
- Browser fixtures verify application behaviour, not live model quality or Cloud Agent parity. `node scripts/test-anna-live-quickstart.js` (the live gate for the new flows) passed on October 22 against the local APS harness.
- Strict Anna validation passes.
- Version 1.1.0 is local and awaiting owner review. No upload or resubmission is authorized.

## Source map

- `anna/src/` — submission app source
- `anna/bundle/` — generated Anna bundle
- `anna/manifest.json` — Anna permissions and host APIs
- `anna/src/followup.js` — reply evidence, drafts, sent history and follow-up rules
- `anna/src/followup-view.js` — reply workspace, follow-up panel and attention queue
- `anna/src/i18n.js` — English/Simplified Chinese strings
- `anna/src/json.js` — model-output parsing and result contracts
- `docs/LAUNCH_PLAN.md` — program rules, critical path and distribution plan
- `scripts/build-anna.js` — deterministic bundle build
- `SUBMISSION.md` — pitch and demo script
- `PRIVACY.md` — privacy disclosure
- `public/` and `src/` — preserved legacy web prototype

Edit `anna/src/` and rebuild; do not edit generated bundle files directly.

## Product safeguards

Every model request requires explicit consent. Drafts and analyses include a bounded, chronological conversation history so Anna does not ask for things already sent. See [PRIVACY.md](PRIVACY.md) for the exact inputs. Its prompts forbid invented policies, deadlines, contacts, rights, or outcomes. Rebuilt plans retain completed work and five previous plan snapshots. Plan source links must match user-supplied HTTPS URLs. Reply quotes are checked against the original pasted text; unsupported interpretations are labelled for confirmation. Quotes establish a text match, not the truth of the sender's claims.

Drafts remain editable and are never sent by the app. Missing details use visible placeholders. Users explicitly record when they have sent a response, which preserves the text in history and moves the goal to Waiting for a reply. Check-in dates are chosen by the user and drive the Attention today list when the app is open. There are no background reminders or email integrations.

`npm run anna:dev` uses real APS storage and live model calls through the signed-in Anna CLI account. It requires Anna login and network access. `npm run anna:dev:offline` disables model calls and uses temporary legacy storage, which can reset when the harness session ends. A failed remote read blocks editing rather than restoring an unrelated browser cache.
