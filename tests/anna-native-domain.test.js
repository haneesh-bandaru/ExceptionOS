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
    note: 'Saved the acknowledgement email.', kind: 'evidence', evidenceUrl: 'https://example.com/evidence', recordedAt: goal.updates[0].createdAt
  });
  goal = applyPlan(goal, { summary: 'Use the new context.', questions: [], steps: [
    { title: 'Use the saved update', why: 'It narrows the request.', doneWhen: 'The revised request is ready.', sourceUrl: '' }
  ] });
  assert.equal(goal.planNeedsRefresh, false);
  assert.equal(goal.steps[0].completed, true);
  assert.equal(goal.planHistory.length, 1);
  goal = resolveGoal(goal, 'The organization issued its decision.');
  assert.equal(goal.status, 'resolved');
});

test('workspace normalization drops invalid records and strips unsafe evidence links', () => {
  const clean = normalizeWorkspace({ activeGoalId: 'missing', goals: [null, { id: 'g1', title: 'Goal', outcome: 'Done', steps: [null, { title: 'Step', doneWhen: 'Complete', sourceUrl: 'javascript:alert(1)' }], updates: [null], planHistory: [null, { steps: [null, { title: 'Earlier action' }] }] }] });
  assert.equal(clean.goals.length, 1);
  assert.equal(clean.activeGoalId, 'g1');
  assert.equal(clean.goals[0].steps[0].sourceUrl, '');
  assert.equal(clean.goals[0].updates.length, 0);
  assert.equal(clean.goals[0].planHistory[0].steps[0].title, 'Earlier action');
  assert.throws(() => addUpdate(clean.goals[0], 'proof', 'http://insecure.example'), /https/);
});

test('Anna storage response unwraps saved workspace across remounts', () => {
  const workspace = { version: 1, goals: [{ id: 'goal-1', title: 'Persist me' }], activeGoalId: 'goal-1' };
  assert.equal(unwrapStorageValue({ value: workspace }), workspace);
  assert.equal(unwrapStorageValue(workspace), workspace);
  assert.equal(unwrapStorageValue({ value: null }), null);
});

test('rebuild input retains completed work, unanswered questions and evidence context', () => {
  let goal = createGoal({ title: '秋招', outcome: '拿到2个offer' });
  goal = applyPlan(goal, { summary: 'Search', questions: ['Target role?'], steps: [
    { title: 'Prepare CV', why: 'Applications', doneWhen: 'CV ready', sourceUrl: '' }
  ] });
  goal = toggleStep(goal, goal.steps[0].id);
  goal = addUpdate(goal, '市场相关岗位', 'https://example.com/jobs');
  const input = planRequest(goal);
  assert.equal(input.currentPlan[0].completed, true);
  assert.equal(input.outstandingQuestions[0], 'Target role?');
  assert.equal(input.recentUpdates.length, 1);
  assert.equal(input.recentUpdates[0].note, '市场相关岗位');
  const next = applyPlan(goal, { summary: 'Marketing', changeSummary: 'Focused on marketing', questions: [], steps: [
    { title: 'Prepare CV', doneWhen: 'CV ready' },
    { title: 'Shortlist marketing roles', doneWhen: 'Five roles listed', sourceUrl: 'https://example.com/jobs' }
  ] });
  assert.equal(next.steps.length, 2);
  assert.equal(next.steps[0].id, goal.steps[0].id);
  assert.equal(next.steps[0].completed, true);
  assert.equal(next.steps[1].sourceUrl, 'https://example.com/jobs');
  assert.equal(next.questions.length, 0);
  assert.equal(next.changeSummary, 'Focused on marketing');
  assert.equal(next.planHistory[0].steps[0].completed, true);
  assert.equal(goal.questions.length, 1, 'preview construction does not mutate saved goal');
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

