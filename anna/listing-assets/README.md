# Listing assets

- `logo.svg`: ExceptionOS brand mark.
- `01-home.png`: the one-screen start — paste a message (here the built-in fictional sample), optional outcome, and consent.
- `02-reply-draft.png`: the result of one Anna run: the interpretation with source quotes, and an editable reply with placeholders.
- `03-follow-up.png`: the "I haven't heard back" route — a polite follow-up drafted from the user's last message, ready to copy and record as sent.
- `04-action-plan.png`: the optional goal planner for bigger situations.

The screenshots show the actual application UI with synthetic details and deterministic model responses. They are presentation assets, not evidence of live model performance or real user outcomes. `docs/review-preview/zh-mobile-reply.png` shows the Chinese interface on a phone.

Regenerate with:

```sh
npx playwright test tests/browser/anna-review.spec.js --grep "capture current listing"
```

No assets have been uploaded or synced to the Marketplace in this revision.
