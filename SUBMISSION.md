# ExceptionOS — hackathon submission draft

## One-line pitch

Paste any message that needs a reply. See what they want, and get an editable draft in one step. Haven't heard back? Get a polite follow-up instead.

## Problem

People stall on messages from recruiters, schools, landlords, government offices, and clients. Requests are buried, deadlines are vague, and writing the reply is the hard part. When nobody replies at all, people don't know how to follow up without sounding pushy.

## Solution

The home screen asks one question: did you get a message, or haven't you heard back?

- **I got a message:** paste it, optionally say what you want, tick consent. One Anna run returns a grounded reading (requests, deadline as written, likely blocker, each quoted from the original; unquoted points are flagged) and an editable reply. Missing details become placeholders instead of invented facts.
- **I haven't heard back:** describe your last message. Anna drafts a short, polite follow-up.

The user copies the text, sends it themselves, records it as sent, and chooses a check-in. Attention today shows what is due. Later replies and drafts include the earlier conversation, so Anna does not ask for something already sent. Backfilled older messages join the history without replacing the current one. For bigger situations, an optional planner builds and rebuilds a short action plan. The interface is available in English and Simplified Chinese.

## Why Anna

Anna is the product runtime rather than a badge added to a normal web app. Anna provides model inference, signed-in private storage, and the application window lifecycle. There is no separate login, backend, database, API key, or Vercel deployment.

## 90-second demo script

Use synthetic details and say so. Record against a live Anna model; label any cut that removes loading time.

1. **0–10 s:** "Here's an email from a recruiter. What do they actually want?" Show the home screen.
2. **10–20 s:** Click **Try it with a sample message** (or paste a synthetic one), add "Get an interview date", tick consent, click **Read it and draft my reply**.
3. **20–45 s:** Walk the result: blocker and requests with quotes; click **Read original reply**; point out that "Friday" is kept as written and not scheduled.
4. **45–60 s:** Fill two placeholders in the draft, **Copy response**, tick "I sent this", choose a check-in, **Record as sent**. The goal moves to Waiting for a reply.
5. **60–75 s:** Home → **I haven't heard back** → describe a last message → **Draft my follow-up**.
6. **75–90 s:** Toggle **中文** to show the Chinese interface; close with "nothing is sent for you, and everything stays in your Anna storage."

The listing screenshots use deterministic model fixtures and synthetic data. They are not evidence of live model quality.

## Submission evidence checklist

- [x] Logo, four current product screenshots (1.1.0 quick start, reply draft, follow-up, planner), shortened listing copy
- [x] Repeatable local regression for the five review findings
- [x] Recovery coverage for failed storage/model calls and mobile goal switching
- [x] Reply analysis, source matching, editable drafting, and follow-up queue
- [x] Live Anna/APS reply and response workflow, including reopen persistence
- [x] Privacy disclosure covers quick start, follow-up drafting, conversation history, planning, and stored data
- [x] One-step quick start, no-reply follow-up route, Chinese interface, one automatic retry for malformed model output
- [x] Audit fixes: reply chronology, conversation context, proposals kept across navigation, resolved-goal lock, dialog focus
- [x] Live quick-start gate (Oct 22): one live Anna run returned the reading and draft in 8 s with 5 quotes, all matching the source, plus placeholders and no auto-scheduled date; the no-reply follow-up draft also passed; synthetic goals cleaned up
- [ ] DoraHacks BUIDL submitted by October 31, 15:59 UTC (draft in [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md))
- [ ] Owner approval to upload the candidate and metadata
- [ ] Fresh-install Cloud Agent end-to-end test of the uploaded candidate
- [ ] Live-model demo recording and reviewer-visible test report
- [ ] Owner permission to resubmit
- [ ] Real-user pilot and platform-qualified monthly activity

See [the review report](docs/ANNA_REVIEW_FIX_REPORT.md), [the user-validation plan](docs/USER_VALIDATION_PLAN.md), and [the launch plan](docs/LAUNCH_PLAN.md). This is a draft; no new submission has been made.

## Technical notes

- Static Anna App bundle with no external origins
- Anna `llm.complete` for constrained JSON: one combined analysis-and-draft call for quick start, follow-up drafting, reply analysis, response drafting, and planning, with one automatic retry on malformed output
- Anna user storage for versioned workspace persistence
- Explicit model-processing consent and input minimization
- Responsive, keyboard-friendly interface with reduced-motion support
