# ExceptionOS for Anna

ExceptionOS helps people answer any message that needs a reply: one Anna run reads the message (with source quotes) and drafts an editable reply, or drafts a polite follow-up when nobody has replied. Sent records, chosen check-ins, conversation history, and an optional action plan keep things moving. English and Simplified Chinese.

## Anna integration

- `anna.llm.complete` returns constrained JSON after explicit consent: combined reading-and-draft, follow-up drafts, reply analysis, response drafts, and 3–6 step plans. Malformed output is retried once.
- `anna.storage` keeps each signed-in user's workspace private and persistent.
- `anna.window` signals readiness and sets the app title.
- The app has no separate login, server, database, environment variable, or hosted API.
- The bundle makes no external network request. Model credentials remain with Anna.

## Run locally

```sh
npm install
npm run anna:validate
npm run anna:dev
```

Open `http://localhost:5180`. The live command uses the authorized Anna developer session, real APS storage, and live model calls. `npm run anna:dev:offline` uses temporary legacy storage and disables model calls.

Edit source in `anna/src/`. `npm run anna:build` recreates `anna/bundle/`; generated bundle files should not be edited directly.

## Product flow

1. Home: choose **I got a message** (paste it) or **I haven't heard back** (describe your last message). Optionally state the outcome, tick consent, submit.
2. One Anna run returns the reading (requests, stated deadlines, possible blocker, each with a checked quote) and an editable draft, or a follow-up draft. The message is saved first, so a failed run can be retried.
3. Edit the draft, fill placeholders, copy it into your own app, record it as sent, and choose a check-in.
4. Attention today shows due check-ins and goals needing action. A newer reply makes the goal need action again; a backfilled older reply joins history without replacing the current one.
5. Later analyses and drafts include earlier replies, sent responses, follow-ups, and completed actions.
6. Optional: **Start with a goal** for a 3–6 step plan; rebuild after new context, review the proposal (kept per goal across navigation), and apply or discard it.
7. Record the outcome and close or reopen the goal. Resolved goals cannot be edited until reopened.

AI suggestions are organizational guidance. The system prompt forbids invented policies, deadlines, contacts, rights, or source URLs, and the interface asks users to review every suggestion before acting.
