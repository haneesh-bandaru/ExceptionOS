import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoal, normalizeWorkspace, planRequest, resolveGoal } from '../anna/src/domain.js';
import { addReply, applyReplyAnalysis, attentionGoals, followUpStatus, missingPlaceholders, recordResponseSent, replyRequest, saveResponseDraft, setFollowUp, validDay } from '../anna/src/followup.js';

const fresh = () => createGoal({ title: 'Marketing application', outcome: 'Get a clear next step' });
const source = 'Your application is on hold until we receive two campaign examples. Please reply by Friday.';
const analysis = {
  summary: 'Prepare the requested campaign examples.',
  blocker: { text: 'The team is waiting for two examples.', quote: 'on hold until we receive two campaign examples' },
  facts: [{ kind: 'deadline', text: 'Reply by Friday; confirm which date.', quote: 'Please reply by Friday.' }, { kind: 'fact', text: 'An ungrounded claim', quote: 'This quote was invented' }],
  recommendations: [{ text: 'Prepare two campaign examples.', quote: 'two campaign examples' }], questions: ['Which Friday is intended?'], assumptions: []
};

test('old workspaces migrate without losing goals; malformed reply records are ignored', () => {
  const workspace = normalizeWorkspace({ goals: [{ id: 'old', title: 'Existing', replies: [null, { id: 'bad' }], updates: [{ body: 'Keep this note' }] }] });
  assert.deepEqual(workspace.goals[0].followUp, { stage: 'needs_action', checkInDate: '', lastSentAt: null });
  assert.deepEqual(workspace.goals[0].replies, []);
  assert.equal(workspace.goals[0].updates[0].body, 'Keep this note');
});

test('reply analysis verifies quotes against original text and leaves inferred dates unscheduled', () => {
  let goal = addReply(fresh(), { sourceText: source, receivedOn: '2026-10-21' });
  const original = structuredClone(goal);
  goal = applyReplyAnalysis(goal, goal.replies[0].id, analysis);
  assert.equal(goal.replies[0].analysis.blocker.supported, true);
  assert.equal(goal.replies[0].analysis.facts[0].quote, 'Please reply by Friday.');
  assert.equal(goal.replies[0].analysis.facts[1].supported, false);
  assert.equal(goal.replies[0].analysis.facts[1].quote, '');
  assert.equal(goal.followUp.checkInDate, '');
  assert.equal(original.replies[0].analysis, null, 'analysis must not mutate the saved goal');
  assert.throws(() => applyReplyAnalysis(goal, goal.replies[0].id, {}), /incomplete/);
});

test('recording sent requires confirmation and filled placeholders, archives the draft, and survives normalization', () => {
  let goal = addReply(fresh(), { sourceText: source });
  const replyId = goal.replies[0].id;
  const incomplete = { subject: 'Portfolio', body: 'Here is [ADD LINK]. Signed {{NAME}}.' };
  goal = saveResponseDraft(goal, replyId, incomplete);
  assert.equal(missingPlaceholders(incomplete).length, 2);
  assert.throws(() => recordResponseSent(goal, replyId, incomplete, '', false), /Confirm/);
  assert.throws(() => recordResponseSent(goal, replyId, incomplete, '', true), /placeholders/);
  const finished = { subject: 'Portfolio', body: 'Here are the examples we discussed.' };
  const sent = recordResponseSent(goal, replyId, finished, '2026-10-28', true);
  const reloaded = normalizeWorkspace({ goals: [sent] }).goals[0];
  assert.equal(reloaded.followUp.stage, 'waiting');
  assert.equal(reloaded.followUp.checkInDate, '2026-10-28');
  assert.equal(reloaded.replies[0].draft, null);
  assert.equal(reloaded.replies[0].sentResponses[0].body, finished.body);
  assert.ok(reloaded.replies[0].sentResponses[0].sentAt);
  assert.equal(goal.followUp.stage, 'needs_action', 'failed or pending writes can keep the previous state');
});

test('check-ins are calendar dates, due goals sort first, and resolved goals leave the queue', () => {
  assert.equal(validDay('2026-02-30'), '');
  assert.equal(validDay('2026-10-21'), '2026-10-21');
  const due = setFollowUp(fresh(), 'waiting', '2026-10-20');
  const future = setFollowUp(fresh(), 'waiting', '2026-10-28');
  const unscheduled = setFollowUp(fresh(), 'waiting', '');
  const actionable = fresh();
  const resolved = resolveGoal(due, 'Done');
  assert.equal(followUpStatus(due, '2026-10-21'), 'Follow-up due');
  assert.equal(followUpStatus(future, '2026-10-21'), 'Waiting for a reply');
  assert.deepEqual(attentionGoals([future, actionable, unscheduled, resolved, due], '2026-10-21'), [due, actionable]);
  assert.throws(() => setFollowUp(due, 'waiting', '2026-02-30'), /valid/);
});

test('a new reply requires action, preserves sent history, and reaches the next model request', () => {
  let goal = addReply(fresh(), { sourceText: source });
  const first = goal.replies[0].id;
  goal = recordResponseSent(goal, first, { body: 'Here is my response.' }, '2026-10-28', true);
  goal = addReply(goal, { sourceText: 'Thanks. Please confirm your availability.', sender: 'Recruiting' });
  assert.equal(goal.followUp.stage, 'needs_action');
  assert.equal(goal.followUp.checkInDate, '');
  assert.equal(goal.replies[1].sentResponses[0].body, 'Here is my response.');
  assert.equal(planRequest(goal).recentReplies[0].sourceText, 'Thanks. Please confirm your availability.');
  assert.equal(planRequest(goal).recentReplies[1].lastSentResponse, 'Here is my response.');
  assert.equal(replyRequest(goal, first).reply.sourceText, source);
  assert.throws(() => recordResponseSent(goal, first, { body: 'Old response' }, '', true), /latest reply/);
  assert.throws(() => addReply(resolveGoal(goal, 'Done'), { sourceText: 'New' }), /Reopen/);
});
