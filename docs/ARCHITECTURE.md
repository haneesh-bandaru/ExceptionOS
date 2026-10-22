# Architecture — ExceptionOS v1.0

## Submission runtime

The Anna app is a static ES-module bundle generated from `anna/src/`. There is no application server.

`app.js` renders the product flow and handles user actions. `domain.js` contains normalization, goal lifecycle, plan application, progress, evidence-link validation, and resolution logic. `followup.js` handles pasted replies, quote matching, editable response drafts, immutable sent-response records, and calendar-based check-ins. `followup-view.js` renders that workspace and the home attention queue. `platform.js` is the only Anna SDK boundary.

## Anna boundary

The manifest requests the narrow host surface used by the product:

- `llm.complete` for consented planning, reply analysis, and response drafting
- `storage.get` and `storage.set` for the private user workspace
- `window.ready` and `window.set_title` for lifecycle integration

The bundle declares no external origins. It contains no credentials, account implementation, or user data.

## Data model

A single versioned workspace value contains goals and the active goal ID. Each normalized goal contains the desired outcome, limited context, plan questions, ordered steps, progress updates, optional HTTPS evidence URLs, resolution, change summary, and up to five previous plan snapshots. Normalization runs on every load and save to discard malformed records and bound text sizes.

Reply records add the original pasted text (up to 6,000 characters), optional sender and received date, structured analysis, an editable draft, and sent-response history. Old workspaces normalize to an empty reply list and Needs your action status without losing existing goals. Follow-up state contains a user-selected calendar date and Waiting/Needs action status. Due dates are derived against the user's local calendar each render; no scheduler or external notification service is used. A new reply clears the prior check-in and requires action again. Resolved goals leave the attention queue.

Anna storage is authoritative. Missing remote values produce an empty workspace; failed reads block editing until retry succeeds. Obsolete local cache data is removed after a successful read. The live development command uses APS; the offline command uses legacy in-memory storage that can reset on a fresh harness session.

Writes render optimistic progress with a persistent saving indicator and disable competing actions. Failures restore the previous workspace while retaining typed notes and resolution text. Rebuilding calls the model without removing the current checklist. The proposed plan remains in memory until the user applies it; a failed apply keeps both the saved original and the retryable proposal. Completed actions retain their IDs, and prior plan snapshots are saved with the replacement.

Storage writes replace one workspace value. Simultaneous edits from separate app sessions are not merged; the manifest requests a single window instance, but this is not a cross-device conflict-resolution system.

## Model trust boundary

The user explicitly checks consent before each model request. Goal fields, the current checklist with completion state, outstanding questions, and the ten most recent non-milestone notes with evidence URLs are serialized. The system prompt treats this content as untrusted data, asks for the user's language and latest facts, and forbids invented policies, deadlines, contacts, legal rights, sources, or promised outcomes. Output must parse as the expected JSON object. Domain validation requires at least one remaining concrete step and accepts HTTPS source URLs only when they exactly match URLs supplied in the goal, updates, or latest two replies.

Planning also includes the latest two replies and their most recently recorded responses. Reply analysis and drafting use separate request contracts, per-request consent, and the selected reply plus relevant context described in PRIVACY.md. Source quotes must be exact substrings of the saved message. Unmatched quotes are removed and the interpretation is shown as needing confirmation. This validates provenance of quoted text, not semantic correctness. Relative deadline text is displayed as stated and never scheduled automatically.

Response generation uses placeholders for missing facts. Saving and copying a draft do not mark it as sent. An explicit user confirmation, filled placeholders, and a successful storage write are required to record a response as sent; the draft then moves to history and the goal waits for a reply. No email is sent. Clipboard failure falls back to selecting the response for manual copying.

Semantic quality, including whether a live model removes answered questions and adapts to new facts, requires live-model testing. Deterministic fixtures verify the request contract and UI lifecycle only.

## Legacy application

The prior Node/SQLite case manager remains available under `src/` and `public/`. It is isolated from the Anna bundle and retained for regression coverage and possible future extraction.
