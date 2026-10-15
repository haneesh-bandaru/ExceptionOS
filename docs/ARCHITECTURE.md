# Architecture — ExceptionOS v1.0

## Submission runtime

The Anna app is a static ES-module bundle generated from `anna/src/`. There is no application server.

`app.js` renders the product flow and handles user actions. `domain.js` contains normalization, goal lifecycle, plan application, progress, evidence-link validation, and resolution logic. `platform.js` is the only Anna SDK boundary.

## Anna boundary

The manifest requests the narrow host surface used by the product:

- `llm.complete` for consented action-plan generation
- `storage.get` and `storage.set` under `storage.user` for the private workspace
- `window.ready` and `window.set_title` for lifecycle integration

The bundle declares no external origins. It contains no credentials, account implementation, or user data.

## Data model

A single versioned workspace value contains goals and the active goal ID. Each normalized goal contains the desired outcome, limited context, plan questions, ordered steps, progress updates, optional HTTPS evidence URLs, and resolution. Normalization runs on every load and save to discard malformed records and bound text sizes.

The browser writes a same-origin local cache as a development fallback, while Anna user storage is authoritative when the runtime is connected. The alpha local harness can reset its legacy in-memory backend on a full dashboard reload; hosted Anna storage is designed for persistence across app sessions.

## Model trust boundary

The user explicitly checks consent before a model request. Only the displayed goal fields are serialized. The system prompt treats all goal text as untrusted data and forbids invented policies, deadlines, contacts, legal rights, sources, or promised outcomes. Output must parse as the expected JSON object. Domain validation requires at least one concrete step and accepts only HTTPS source URLs; the prompt directs the model to return a URL only when it appeared in user input.

## Legacy application

The prior Node/SQLite case manager remains available under `src/` and `public/`. It is isolated from the Anna bundle and retained for regression coverage and possible future extraction.
