# Anna Marketplace review fix report

**Date:** October 20, 2026  
**Candidate:** ExceptionOS 1.0.1  
**Submission state:** Local candidate only; not uploaded or resubmitted

## Review findings and fixes

| Finding | Fix | Verification |
| --- | --- | --- |
| Listing lacked a logo, screenshots, and enough detail | Added a purpose-built SVG logo, three real product screenshots, and a three-paragraph description covering the workflow, storage, user control, and limitations. | `apps sync-meta --dry-run --json` recognized the description, logo, and all three screenshots without publishing them. |
| “Close as resolved” did nothing | Replaced the sandbox-blocked native prompt with an accessible in-app confirmation and required outcome field. A successful close now renders the resolved card, outcome, confirmation toast, and Reopen action. | Browser regression closed the reviewer-style goal and verified the visible outcome and Reopen action. |
| “Mark complete” was slow with no feedback | Progress now updates optimistically, interactions are guarded while saving, and a persistent “Saving progress…” indicator remains visible until Anna storage confirms the write. A failed write restores the previous state. | Browser regression delayed `storage.set` by 1.5 seconds and verified immediate 20% progress plus the saving indicator and final confirmation. |
| Saved updates did not explain or affect rebuilding | Saving context now marks the plan as stale and displays a prominent explanation and “Rebuild plan with Anna” action. Rebuild requests include the ten most recent progress entries, and a successful rebuild clears the stale state. | The exact update `市场相关岗位` triggered the notice; the regression rebuilt the plan, retained the progress entry, and verified that recent updates are included in the model request contract. |
| Progress history disappeared after closing the App | Anna storage responses are unwrapped before normalization, while local cache remains a fallback. Progress can also be recorded before the first plan. | A synthetic goal and progress-log entry were saved through real APS, the harness was fully stopped and restarted, and both were restored in a new app session. The synthetic record was then removed. |

## Reviewer-flow test

The deterministic run used the reported inputs: goal `秋招`, target `拿到2个offer`, and update `市场相关岗位`. It covered plan creation, a deliberately slow completion write, saved-update guidance, app remount, rebuild, resolution, and the visible resolved state.

Validation completed:

- 44 automated tests passed.
- The end-to-end reviewer browser regression passed, including a 390×844 mobile overflow check.
- The real APS stop/start persistence regression passed and cleaned up its remote fixture.
- `@anna-ai/cli@0.1.58 validate --strict` passed.
- Marketplace metadata dry run passed with the new logo and screenshots.

## Remaining release gate

The candidate must be uploaded before Anna's Cloud Agent can perform a true fresh-install test. Upload, metadata sync, version cut, and review resubmission remain intentionally blocked until the owner gives explicit permission.
