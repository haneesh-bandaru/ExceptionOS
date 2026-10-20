import test from 'node:test';
import assert from 'node:assert/strict';
import { addUpdate, applyPlan, createGoal, emptyWorkspace, nextStep, normalizeWorkspace, planRequest, progress, resolveGoal, toggleStep, unwrapStorageValue, upsertGoal } from '../anna/src/domain.js';

test('goal lifecycle moves from outcome to plan to resolution', () => {
  let workspace = emptyWorkspace();
  let goal = createGoal({ title: 'Get an application decision', outcome: 'Receive a written decision', context: 'Applied last month', attempted: 'Sent one follow-up', category: 'Education' });
  workspace = upsertGoal(workspace, goal);
  assert.equal(workspace.goals.length, 1);
  assert.equal(progress(goal), 0);
  goal = applyPlan(goal, { summary: 'Confirm ownership and request a decision.', questions: ['Was a timeline promised?'], steps: [
    { title: 'Collect the record', why: 'A complete timeline makes the follow-up precise.', doneWhen: 'Dates and messages are in one note.', sourceUrl: '' },
    { title: 'Send a focused request', why: 'Ask for the decision and expected date.', doneWhen: 'The request is sent and saved.', sourceUrl: '' }
  ] });
  assert.equal(goal.steps.length, 2);
  assert.equal(nextStep(goal).title, 'Collect the record');
  goal = toggleStep(goal, goal.steps[0].id);
  assert.equal(progress(goal), 50);
  assert.equal(nextStep(goal).title, 'Send a focused request');
  goal = addUpdate(goal, 'Saved the acknowledgement email.', 'https://example.com/evidence');
  assert.equal(goal.updates[0].kind, 'evidence');
  assert.equal(goal.planNeedsRefresh, true);
  assert.deepEqual(planRequest(goal).recentUpdates[0], {
    note: 'Saved the acknowledgement email.', kind: 'evidence', recordedAt: goal.updates[0].createdAt
  });
  goal = applyPlan(goal, { summary: 'Use the new context.', questions: [], steps: [
    { title: 'Use the saved update', why: 'It narrows the request.', doneWhen: 'The revised request is ready.', sourceUrl: '' }
  ] });
  assert.equal(goal.planNeedsRefresh, false);
  goal = resolveGoal(goal, 'The organization issued its decision.');
  assert.equal(goal.status, 'resolved');
});

test('workspace normalization drops invalid records and strips unsafe evidence links', () => {
  const clean = normalizeWorkspace({ activeGoalId: 'missing', goals: [null, { id: 'g1', title: 'Goal', outcome: 'Done', steps: [{ title: 'Step', doneWhen: 'Complete', sourceUrl: 'javascript:alert(1)' }] }] });
  assert.equal(clean.goals.length, 1);
  assert.equal(clean.activeGoalId, 'g1');
  assert.equal(clean.goals[0].steps[0].sourceUrl, '');
  assert.throws(() => addUpdate(clean.goals[0], 'proof', 'http://insecure.example'), /https/);
});

test('Anna storage response unwraps saved workspace across remounts', () => {
  const workspace = { version: 1, goals: [{ id: 'goal-1', title: 'Persist me' }], activeGoalId: 'goal-1' };
  assert.equal(unwrapStorageValue({ value: workspace }), workspace);
  assert.equal(unwrapStorageValue(workspace), workspace);
});

test('required fields and plan contract fail clearly', () => {
  assert.throws(() => createGoal({ title: '', outcome: 'Done' }), /title/);
  assert.throws(() => createGoal({ title: 'Goal', outcome: '' }), /outcome/);
  const goal = createGoal({ title: 'Goal', outcome: 'Done' });
  assert.throws(() => applyPlan(goal, { summary: 'x', questions: [], steps: [] }), /actionable/);
});

test('model cannot introduce a source URL that the user did not supply', () => {
  const goal = createGoal({ title: 'Goal', outcome: 'Done', context: 'Official page: https://example.org/status' });
  const planned = applyPlan(goal, { summary: 'Plan', questions: [], steps: [
    { title: 'Allowed source', why: 'User supplied it', doneWhen: 'Checked', sourceUrl: 'https://example.org/status' },
    { title: 'Invented source', why: 'Model supplied it', doneWhen: 'Ignored', sourceUrl: 'https://fake.example/policy' }
  ] });
  assert.equal(planned.steps[0].sourceUrl, 'https://example.org/status');
  assert.equal(planned.steps[1].sourceUrl, '');
});

