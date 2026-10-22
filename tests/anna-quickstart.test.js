import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addUpdate, applyPlan, applySuggestedTitle, createGoal, normalizeWorkspace, planRequest, quickStartGoal, resolveGoal, toggleStep } from '../anna/src/domain.js';
import { addReply, conversation, nudgeRequest, recordNudgeSent, recordResponseSent, replyRequest, saveNudgeDraft, setFollowUp } from '../anna/src/followup.js';
import { isAnalysis, isDraft, parseJson } from '../anna/src/json.js';
import { dictionaries } from '../anna/src/i18n.js';

const fresh = () => createGoal({ title: 'Marketing application', outcome: 'Get a clear next step' });

test('a backfilled older reply joins history without replacing the current reply or its check-in', () => {
  let goal = addReply(fresh(), { sourceText: 'The interview will be online.', receivedOn: '2026-10-21' });
  const current = goal.replies[0].id;
  goal = recordResponseSent(goal, current, { body: 'Thanks, online works for me.' }, '2026-10-28', true);
  goal = addReply(goal, { sourceText: 'Please attend the office.', receivedOn: '2026-10-20' });
  assert.equal(goal.replies[0].id, current, 'the newest received reply stays first');
  assert.equal(goal.replies[1].sourceText, 'Please attend the office.');
  assert.equal(goal.followUp.stage, 'waiting');
  assert.equal(goal.followUp.checkInDate, '2026-10-28');
  assert.equal(planRequest(goal).recentReplies[0].sourceText, 'The interview will be online.');
  assert.throws(() => recordResponseSent(goal, goal.replies[1].id, { body: 'Old' }, '', true), /latest reply/);
  const reloaded = normalizeWorkspace({ goals: [goal] }).goals[0];
  assert.equal(reloaded.replies[0].id, current, 'order is stable after reload');
});

test('a newer reply still becomes current; same-day replies keep the most recently saved first', () => {
  let goal = addReply(fresh(), { sourceText: 'First', receivedOn: '2026-10-20' });
  goal = setFollowUp(goal, 'waiting', '2026-10-25');
  goal = addReply(goal, { sourceText: 'Second', receivedOn: '2026-10-20' });
  assert.equal(goal.replies[0].sourceText, 'Second');
  assert.equal(goal.followUp.stage, 'needs_action');
  goal = addReply(goal, { sourceText: 'Undated' });
  assert.equal(goal.replies[0].sourceText, 'Undated', 'an undated reply falls back to the day it was saved');
});

test('later drafts receive the earlier conversation and completed actions', () => {
  let goal = applyPlan(fresh(), { summary: 'Plan', questions: [], steps: [{ title: 'Choose two campaign examples', why: 'Requested', doneWhen: 'Chosen' }] });
  goal = toggleStep(goal, goal.steps[0].id);
  goal = addReply(goal, { sourceText: 'Please send two campaign examples.', sender: 'Recruiting', receivedOn: '2026-10-10' });
  goal = recordResponseSent(goal, goal.replies[0].id, { body: 'Here are both examples: https://example.com/portfolio' }, '', true);
  goal = addReply(goal, { sourceText: 'Thanks. Are you free for an interview on Tuesday?', receivedOn: '2026-10-21' });
  const request = replyRequest(goal, goal.replies[0].id);
  assert.deepEqual(request.earlierConversation.map(item => item.type), ['received', 'you_sent']);
  assert.match(request.earlierConversation[0].text, /two campaign examples/);
  assert.match(request.earlierConversation[1].text, /example\.com\/portfolio/);
  assert.ok(!request.earlierConversation.some(item => item.text.includes('Tuesday')), 'the selected reply is not duplicated');
  assert.deepEqual(request.completedActions, ['Choose two campaign examples']);
});

test('no-reply route: last contact, follow-up draft, sent record, and check-in without an inbound reply', () => {
  let goal = quickStartGoal({ mode: 'waiting', organization: 'Acme recruiting', lastContact: 'Applied for the analyst role and followed up once.', lastContactOn: '2026-10-02' });
  assert.equal(goal.replies.length, 0);
  assert.equal(goal.title, 'Acme recruiting');
  const request = nudgeRequest(goal, 'Keep it short', '2026-10-22');
  assert.deepEqual(request.lastContact, { text: 'Applied for the analyst role and followed up once.', on: '2026-10-02' });
  assert.equal(request.today, '2026-10-22');
  assert.equal(request.conversation[0].type, 'your_last_contact');
  goal = saveNudgeDraft(goal, { subject: 'Following up', body: 'Hello [NAME], checking in.', missingInformation: ['Name'] });
  assert.throws(() => recordNudgeSent(goal, goal.outreach.draft, '', true), /placeholders/);
  assert.throws(() => recordNudgeSent(goal, { body: 'Hello, checking in.' }, '', false), /Confirm/);
  goal = recordNudgeSent(goal, { subject: 'Following up', body: 'Hello Sam, checking in on my application.' }, '2026-10-29', true);
  const reloaded = normalizeWorkspace({ goals: [goal] }).goals[0];
  assert.equal(reloaded.followUp.stage, 'waiting');
  assert.equal(reloaded.followUp.checkInDate, '2026-10-29');
  assert.equal(reloaded.outreach.draft, null);
  assert.equal(reloaded.outreach.sent[0].body, 'Hello Sam, checking in on my application.');
  assert.deepEqual(conversation(reloaded).map(item => item.type), ['your_last_contact', 'you_sent_follow_up']);
  assert.equal(planRequest(reloaded).followUpsSent[0].body, 'Hello Sam, checking in on my application.');
  assert.throws(() => quickStartGoal({ mode: 'waiting', lastContact: '  ' }), /last message/);
});

test('quick start from a pasted message saves the reply and accepts one suggested title', () => {
  const source = 'Thanks for applying.\nPlease send two campaign examples by Friday.';
  let goal = quickStartGoal({ mode: 'message', sourceText: source, receivedOn: '2026-10-22' }, { outcome: 'Respond clearly.' });
  assert.equal(goal.title, 'Thanks for applying.');
  assert.equal(goal.outcome, 'Respond clearly.');
  assert.equal(goal.replies[0].sourceText, source);
  assert.equal(goal.followUp.stage, 'needs_action');
  goal = applySuggestedTitle(goal, 'Marketing role at Acme');
  assert.equal(goal.title, 'Marketing role at Acme');
  assert.equal(applySuggestedTitle(goal, 'Something else').title, 'Marketing role at Acme', 'only the derived title is replaced');
  const named = quickStartGoal({ mode: 'message', sourceText: source, sender: 'Acme HR' });
  assert.equal(applySuggestedTitle(named, 'Other').title, 'Acme HR', 'a title the user supplied is kept');
  assert.throws(() => quickStartGoal({ mode: 'message', sourceText: '' }), /Paste the message/);
});

test('resolved goals cannot change their checklist or log until reopened', () => {
  let goal = applyPlan(fresh(), { summary: 'Plan', questions: [], steps: [{ title: 'Step', why: 'Why', doneWhen: 'Done' }] });
  goal = resolveGoal(goal, 'Offer received.');
  assert.throws(() => toggleStep(goal, goal.steps[0].id), /Reopen/);
  assert.throws(() => addUpdate(goal, 'Late note'), /Reopen/);
});

test('model output parsing tolerates fences and surrounding prose, and contracts reject incomplete results', () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('Here is the result: {"a":{"b":2}} Hope this helps.'), { a: { b: 2 } });
  assert.throws(() => parseJson('no json here'));
  assert.equal(isDraft({ subject: '', body: 'Hi', missingInformation: [] }), true);
  assert.equal(isDraft({ subject: '', body: '  ', missingInformation: [] }), false);
  assert.ok(isAnalysis({ summary: 's', blocker: { text: 'b', quote: '' }, facts: [], recommendations: [], questions: [], assumptions: [] }));
  assert.ok(!isAnalysis({ summary: 's', blocker: 'b', facts: [], recommendations: [], questions: [], assumptions: [] }));
});

test('every interface string has a Chinese translation', () => {
  const missing = new Set();
  const patterns = [/\b(?:t|announce)\(\s*'((?:[^'\\]|\\.)*)'/g, /Error\(\s*'((?:[^'\\]|\\.)*)'/g, /body: '((?:[^'\\]|\\.)*)', kind: 'milestone'/g, /(?:busyMessage|replyError|nudgeError|planError)\s*=\s*'((?:[^'\\]|\\.)*)'/g, /persist\([^;]*?, '((?:[^'\\]|\\.)*)'(?:, '((?:[^'\\]|\\.)*)')?\)/g];
  for (const file of ['app.js', 'followup-view.js', 'domain.js', 'followup.js', 'platform.js']) {
    const source = fs.readFileSync(new URL(`../anna/src/${file}`, import.meta.url), 'utf8');
    for (const pattern of patterns) for (const match of source.matchAll(pattern)) for (const key of match.slice(1)) {
      if (key && !(key in dictionaries.zh)) missing.add(`${file}: ${key}`);
    }
  }
  for (const status of ['Resolved', 'Follow-up due', 'Waiting for a reply', 'Needs your action']) if (!(status in dictionaries.zh)) missing.add(status);
  assert.deepEqual([...missing], []);
});
