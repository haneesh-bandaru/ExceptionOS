# ExceptionOS v1.0

ExceptionOS turns a stalled real-world goal into one clear next action and keeps the plan, evidence, progress, and outcome together until the goal is resolved.

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
npm run anna:validate
```

Verified October 15, 2026:

- 43 unit, API, storage, safety, and Anna-domain tests pass.
- Official Anna CLI 0.1.58 strict validation passes with schema dispatcher 0.26.0.
- The real Anna development harness connects with the declared `llm.complete`, `storage.get/set`, and `window` scopes.
- A live Anna model call returned a structured four-step action plan and the app saved it through Anna storage.
- Desktop and mobile form factors are declared and the interface includes responsive and reduced-motion styles.

## Source map

- `anna/src/` — submission app source
- `anna/bundle/` — generated Anna bundle
- `anna/manifest.json` — Anna permissions and host APIs
- `scripts/build-anna.js` — deterministic bundle build
- `SUBMISSION.md` — pitch and demo script
- `PRIVACY.md` — privacy disclosure
- `public/` and `src/` — preserved legacy web prototype

Edit `anna/src/` and rebuild; do not edit generated bundle files directly.

## Product safeguards

Plan generation requires explicit consent. The model receives only the goal fields shown in the form. Its prompt forbids invented policies, deadlines, contacts, rights, or URLs and asks for clarification instead of assumptions. The UI labels model output as suggestions that the user must review. Evidence links must use HTTPS.

The local Anna 0.2 alpha harness uses in-memory legacy storage, so a full dashboard reload can start a fresh harness session. The hosted Anna user-storage permission is the production persistence layer.
