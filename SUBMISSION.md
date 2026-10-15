# ExceptionOS — hackathon submission draft

## One-line pitch

ExceptionOS turns a stalled real-world goal into one clear next action, then keeps the plan, evidence, and progress together until it is resolved.

## Problem

People often know the result they need but lose momentum between scattered messages, unclear procedures, and generic AI advice. Existing task managers start after the user already knows what to do. Chatbots produce answers but do not keep the execution loop alive.

## Solution

ExceptionOS begins with the desired outcome. Anna converts the user's context into a short, ordered plan with a visible “done when” condition for each step. The app highlights one next action, tracks notes and evidence, and records the final resolution for future reference.

## Why Anna

Anna is the product runtime rather than a badge added to a normal web app. Anna provides model inference, signed-in private storage, and the application window lifecycle. There is no separate login, backend, database, API key, or Vercel deployment.

## Demo script

1. Create “Get a decision on my application.”
2. Enter the desired outcome, application date, and previous follow-up.
3. Consent to Anna processing and build the plan.
4. Show the single next action and its “done when” condition.
5. Complete the action, add an evidence link, and show progress update.
6. Record the result and close the goal.

## Technical notes

- Static Anna App bundle with no external origins
- Anna `llm.complete` for constrained JSON planning
- Anna user storage for versioned workspace persistence
- Explicit model-processing consent and input minimization
- Responsive, keyboard-friendly interface with reduced-motion support
