# Anna Marketplace review fix report

**Date:** October 21, 2026

**Candidate:** ExceptionOS 1.0.1, local and unpublished

**Decision:** Ready for owner review; Cloud Agent fresh-install verification remains pending.

## Findings and implemented changes

| Finding | Current behavior | Evidence |
| --- | --- | --- |
| Missing listing logo, screenshots, and detail | Logo plus four current product screenshots; expanded audience, workflow, storage, user-control, and limitations copy | Local files in `anna/listing-assets/` and metadata in `anna/app.json`; screenshots use synthetic data and deterministic model fixtures |
| “Close as resolved” did nothing | In-app outcome dialog; visible saving state, resolved card, confirmation, and Reopen action | Browser test covers success and failed-save retry with the typed outcome preserved; live Anna run closed and showed the outcome |
| “Mark complete” was slow without feedback | Immediate progress update, persistent saving indicator, guarded controls, rollback on failure | Delayed-write browser scenario and official harness regression; live completion persisted |
| Updates did not explain or change the plan | Saved updates mark the plan stale and explain rebuilding. Every rebuild has consent, includes recent notes/evidence, and produces a reviewable proposal. Apply retains completed work and saves the previous plan; Keep current plan discards the proposal | Deterministic tests cover request content, failed generation, discard, failed apply/retry, history, and answered questions. Live model adapted the Chinese case to marketing and did not repeat the role question |
| History disappeared on reopen | Storage envelopes are unwrapped; remote storage is authoritative. A failed load blocks edits, a missing value does not revive stale browser data, and obsolete local cache is removed after a successful read | Browser restart with no cache; live APS-backed full dashboard reload retained the rebuilt plan and note |

## Additional improvements

- Mobile goal selector supports switching among existing goals.
- Application-follow-up starter and focused onboarding.
- Visible plan summary, explanation of changes, and last five previous plan snapshots.
- Model prompts request the user's language and prioritize the latest updates.
- Typed notes and outcome text survive failed saves while the app stays open.
- Failed model requests release loading controls and show persistent retry guidance.
- Normalization tolerates malformed nested history records.
- Live development command explicitly selects the main view and APS storage.
- Privacy disclosure now describes the actual rebuild inputs.
- A Replies & follow-ups workspace saves original messages separately from interpretation. Anna identifies requests, likely blockers, stated deadlines, questions, and suggested actions. Exact source quotes link back to the original; unmatched quotes are removed and marked as needing confirmation.
- Anna prepares editable response drafts with placeholders for missing details. Users can save or copy them. Clipboard restrictions fall back to manual selection.
- Recording a response as sent requires explicit confirmation that the user sent it elsewhere and replacement of bracketed placeholders. Sent responses are retained; the goal then waits for a reply.
- User-chosen check-in dates feed the home Attention today queue. New replies return the goal to Needs your action. No inferred date is automatically scheduled and no external notifications or messages are sent.
- Original replies, drafts, and follow-up dates survive storage failures with retry paths. Unsaved typed text remains when switching tabs during the current session.

## Verification and its limits

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | 50 passed | Domain, legacy API/storage, consent, quote provenance, sent-response history, and calendar contracts |
| `npm run test:e2e` | 8 scenarios passed across the full run and targeted reruns | Six Anna scenarios with a mocked SDK boundary; two legacy browser scenarios. A response-field accessibility-label issue found in the first run was fixed and retested |
| `node scripts/test-anna-review-flow.js` | Passed | Official Anna SDK/local harness; deterministic LLM fixture and legacy session storage |
| `node scripts/test-anna-live-flow.js` | Passed | Official local harness, live Anna model, real APS storage, synthetic data |
| `node scripts/test-anna-live-replies.js` | Passed | Live Anna analysis and drafting; APS-backed recorded response and follow-up date survive a fresh harness session |
| Anna CLI 0.1.58 `validate --strict` | Passed | Package/manifest validation |
| Marketplace `sync-meta --dry-run --json` | Passed | Current description, logo, and four screenshots recognized; nothing published |
| Fresh-install Cloud Agent | Not run | Requires an uploaded candidate and owner permission |

The live run created a uniquely named synthetic goal with outcome `秋招：拿到2个offer`. It built a plan, completed an action, saved a note specifying content and brand marketing, rebuilt and applied the plan, reloaded the entire local dashboard into a new app session, verified the saved note, and closed the goal. The completed action retained its ID. Only the test goal was deleted afterward.

Anna's live change explanation said it shifted from broad role research to preparing materials and applications for content and brand marketing. Remaining questions concerned the user's major, relevant experience, and resume status; the role-direction question was not repeated. This is one successful live run, not a guarantee of model behavior on every input.

On October 21, a second live run pasted a synthetic recruiter reply requesting two campaign examples by Friday. Anna identified the campaign-example blocker and returned five quotes that exactly matched the original text. Draft generation returned visible placeholders. No date was automatically chosen. A synthetic record of sending was saved without contacting anyone; a fresh dashboard session restored that record, waiting status, and the user-selected check-in date. Only the uniquely named QA goal was removed afterward.

An earlier APS attempt verified only goal/note persistence and timed out during live inference. The later runs complete the planning and response flows locally. None is a Cloud Agent install test. The local screenshots demonstrate UI behavior with fixtures, not model-quality evidence or real-user outcomes.

## Owner review

1. Open `http://localhost:5180/` while the live local harness is running.
2. Start an application-follow-up goal using non-sensitive details.
3. Build a plan and complete an action. Open Replies & follow-ups and paste a synthetic recruiter reply requesting two campaign examples by Friday.
4. Consent to analysis. Inspect the blocker, quoted source, stated date, and questions. Check that no date is automatically scheduled.
5. Generate a response, replace its placeholders, edit it, and try Copy response. Copying must not mark it sent. For this test, record a clearly labeled synthetic response without sending any message.
6. Choose a check-in date and inspect the home Attention today queue. Reopen the app to check saved replies and recorded responses.
7. Return to Plan & progress. Rebuild and review the proposed actions/questions; try Keep current plan, then rebuild again and apply. Completed work and previous plans should remain.
8. Resolve with an outcome. Use the harness's mobile view to switch between two goals.

Restart with `npm run anna:dev` if needed. This uses live Anna inference and real APS storage.

## Release gates

No Anna upload, metadata sync, version cut, or resubmission was performed. The existing submission remains version 1.0.0 (app 560, version 1395).

After owner approval to upload, test the uploaded candidate from a fresh install on a Cloud Agent, including close/reopen persistence, the exact reviewer inputs, model failures, mobile navigation, and all five review findings. Capture a live demo and report the actual results. Resubmit only after the owner's separate permission.

Real-user value and qualified monthly activity still need the pilot described in [USER_VALIDATION_PLAN.md](./USER_VALIDATION_PLAN.md). Synthetic QA runs are not traction.
