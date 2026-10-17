# ExceptionOS Demo Test Report

**Date:** October 17, 2026  
**Environment:** Anna development harness, desktop 1100×800 and mobile 390×844  
**Result:** PASS after two defects found during the session were fixed and retested

## Tested journey

| Scenario | Result | Evidence |
| --- | --- | --- |
| Landing and navigation | PASS | Home, new-goal entry point, goal rail, and continue-last-goal path rendered correctly. |
| Goal creation | PASS | Created a synthetic Education goal with desired outcome, organization, context, and prior attempt. |
| Anna consent | PASS | Planning required the explicit processing checkbox before calling Anna. |
| Live Anna planning | PASS | Anna returned a four-step ordered plan, rationale, completion criteria, and three clarification questions. |
| Action progress | PASS | Completing the first action changed progress to 25% and advanced the next action. |
| Progress log and evidence | PASS | Saved an update with an HTTPS evidence link and rendered it in the timeline. |
| Resolution | PASS | Empty outcomes are rejected; a valid outcome closes the goal and displays the resolved state. |
| Reopen | PASS | Reopening restored the active state without losing the plan or evidence. |
| Rebuild confirmation | PASS | The accessible in-app confirmation rendered and cancel preserved the existing plan. |
| Delete confirmation | PASS | The accessible in-app confirmation rendered and cancel preserved the goal. |
| Session persistence | PASS | Goal, plan, 25% progress, and evidence survived a harness remount. |
| Responsive layout | PASS | The home and goal workspaces remained usable at 390×844. |
| Browser diagnostics | PASS | No console warnings or errors were reported after the final journey. |
| Automated suite | PASS | 44 tests passed with zero failures. |
| Anna package validation | PASS | `@anna-ai/cli@0.1.58 validate --strict` passed. |

## Defects found and fixed

1. Native `prompt()` and `confirm()` dialogs did not reliably open inside the Anna sandbox iframe. They were replaced with accessible in-app dialogs for resolve, rebuild, and delete actions.
2. Anna storage reads return a `{ value: workspace }` envelope. The app previously normalized the envelope itself, so a remounted session appeared empty. The load adapter now unwraps the value, and a regression test covers both wrapped and direct responses.

## Anna integration verified

The demo used the Anna runtime for `window.ready`, `window.set_title`, `storage.get`, `storage.set`, and `llm.complete`. The live planning request was processed only after explicit consent. The generated plan came from Anna's configured model provider rather than a local template.

## Scope and remaining presentation work

The journey used synthetic data and did not contact a real university or submit any external form. No blocking product defects remain in the tested hackathon flow. Store screenshots and a short narrated demo remain submission assets rather than application functionality.
