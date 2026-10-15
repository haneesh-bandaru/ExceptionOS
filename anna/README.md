# ExceptionOS for Anna

ExceptionOS turns a stalled real-world goal into a short action plan and keeps the next action, progress notes, evidence links, and final outcome together.

## Anna integration

- `anna.llm.complete` creates a structured 3–6 step plan after explicit user consent.
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

Open `http://localhost:5180`. The live command uses the Anna developer session already authorized on this computer. `npm run anna:dev:offline` starts the interface with model calls disabled.

Edit source in `anna/src/`. `npm run anna:build` recreates `anna/bundle/`; generated bundle files should not be edited directly.

## Product flow

1. Create a goal by naming the desired outcome and relevant context.
2. Explicitly allow Anna to process the goal and build an ordered action plan.
3. Complete one next action at a time.
4. Add notes and HTTPS evidence links to the progress log.
5. Record the outcome and close or reopen the goal.

AI suggestions are organizational guidance. The system prompt forbids invented policies, deadlines, contacts, rights, or source URLs, and the interface asks users to review every suggestion before acting.
