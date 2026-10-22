const text = (value, limit = 600) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const objects = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const strings = value => Array.isArray(value) ? value.map(item => text(item, 400)).filter(Boolean).slice(0, 6) : [];
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const clip = (value, limit) => value.length > limit ? `${value.slice(0, limit)}…` : value;

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
}

export function normalizeFollowUp(value) {
  return { stage: value?.stage === 'waiting' ? 'waiting' : 'needs_action', checkInDate: validDay(value?.checkInDate), lastSentAt: text(value?.lastSentAt, 40) || null };
}

function grounded(item, source) {
  const quote = text(item?.quote, 1000);
  return { text: text(item?.text), quote: quote && source.includes(quote) ? quote : '', supported: Boolean(quote && source.includes(quote)) };
}

export function normalizeAnalysis(value, source) {
  if (!value || typeof value !== 'object') return null;
  return {
    summary: text(value.summary, 800), blocker: grounded(value.blocker, source),
    facts: objects(value.facts).slice(0, 8).map(item => ({ ...grounded(item, source), kind: ['request', 'deadline', 'fact'].includes(item.kind) ? item.kind : 'fact' })).filter(item => item.text),
    recommendations: objects(value.recommendations).slice(0, 6).map(item => grounded(item, source)).filter(item => item.text),
    questions: strings(value.questions), assumptions: strings(value.assumptions)
  };
}

export function normalizeDraft(value) {
  if (!value || typeof value !== 'object' || !text(value.body, 6000)) return null;
  return { subject: text(value.subject, 200), body: text(value.body, 6000), missingInformation: strings(value.missingInformation), updatedAt: text(value.updatedAt, 40), sentAt: text(value.sentAt, 40) || null };
}

// The day a reply arrived: the user's received date, else the day it was saved.
export const replyDay = reply => reply.receivedOn || (reply.createdAt || '').slice(0, 10);

// Newest first by received date; replies from the same day keep the most recently saved first.
export function sortReplies(replies) {
  return [...replies].sort((a, b) => replyDay(b).localeCompare(replyDay(a)) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function normalizeReplies(value) {
  return sortReplies(objects(value).map(reply => {
    const sourceText = text(reply.sourceText, 6000);
    return {
      id: text(reply.id, 120), sourceText, sender: text(reply.sender, 160), receivedOn: validDay(reply.receivedOn), createdAt: text(reply.createdAt, 40),
      analysis: normalizeAnalysis(reply.analysis, sourceText), draft: normalizeDraft(reply.draft),
      sentResponses: objects(reply.sentResponses).map(normalizeDraft).filter(Boolean)
    };
  }).filter(reply => reply.id && reply.sourceText));
}

// Follow-ups for a goal where nobody has replied yet (or not since the user's last message).
export function normalizeOutreach(value) {
  return {
    lastContact: text(value?.lastContact, 3000), lastContactOn: validDay(value?.lastContactOn),
    draft: normalizeDraft(value?.draft), sent: objects(value?.sent).map(normalizeDraft).filter(Boolean).slice(0, 20)
  };
}

function active(goal) {
  if (goal.status === 'resolved') throw Error('Reopen this goal before changing its follow-up.');
}

function replaceReply(goal, replyId, update) {
  active(goal);
  if (!goal.replies.some(reply => reply.id === replyId)) throw Error('This reply is no longer available.');
  return { ...goal, replies: goal.replies.map(reply => reply.id === replyId ? update(reply) : reply) };
}

export function addReply(goal, fields) {
  active(goal);
  const sourceText = text(fields.sourceText, 6000);
  if (!sourceText) throw Error('Paste the reply before saving.');
  if (fields.receivedOn && !validDay(fields.receivedOn)) throw Error('Choose a valid received date.');
  const reply = { id: uid(), sourceText, sender: text(fields.sender, 160), receivedOn: validDay(fields.receivedOn), createdAt: now(), analysis: null, draft: null, sentResponses: [] };
  const replies = sortReplies([reply, ...goal.replies]);
  // A backfilled older message joins the history without replacing the current reply or its check-in.
  if (replies[0].id !== reply.id) {
    return { ...goal, replies, updates: [{ id: uid(), body: 'Saved an earlier reply to the history.', kind: 'milestone', createdAt: now() }, ...goal.updates] };
  }
  return {
    ...goal, replies, followUp: { ...goal.followUp, stage: 'needs_action', checkInDate: '' }, planNeedsRefresh: goal.steps.length > 0,
    updates: [{ id: uid(), body: 'Saved a new reply. Ready to review the next action.', kind: 'milestone', createdAt: now() }, ...goal.updates]
  };
}

export function applyReplyAnalysis(goal, replyId, result) {
  if (!result || typeof result.summary !== 'string' || !result.blocker || !Array.isArray(result.facts) || !Array.isArray(result.recommendations) || !Array.isArray(result.questions) || !Array.isArray(result.assumptions)) throw Error('Anna returned an incomplete reply analysis. Your saved reply is unchanged; please retry.');
  return replaceReply(goal, replyId, reply => {
    const analysis = normalizeAnalysis(result, reply.sourceText);
    if (!analysis.summary || !analysis.blocker.text) throw Error('Anna could not identify a useful interpretation. Please retry with more context.');
    return { ...reply, analysis };
  });
}

export function saveResponseDraft(goal, replyId, fields) {
  const draft = normalizeDraft({ ...fields, updatedAt: now(), sentAt: null });
  if (!draft) throw Error('Write a response before saving it.');
  return replaceReply(goal, replyId, reply => ({ ...reply, draft }));
}

export function missingPlaceholders(draft) {
  return [...new Set(`${draft?.subject || ''}\n${draft?.body || ''}`.match(/\[[^\]\n]+\]|\{\{[^}\n]+\}\}/g) || [])];
}

export function setFollowUp(goal, stage, date) {
  active(goal);
  if (!['needs_action', 'waiting'].includes(stage)) throw Error('Choose a follow-up status.');
  if (date && !validDay(date)) throw Error('Choose a valid check-in date.');
  return { ...goal, followUp: { ...goal.followUp, stage, checkInDate: validDay(date) } };
}

function checkSendable(fields, confirmed) {
  if (!confirmed) throw Error('Confirm you sent the response outside ExceptionOS.');
  if (missingPlaceholders(fields).length) throw Error('Replace the bracketed placeholders before recording this response as sent.');
}

export function recordResponseSent(goal, replyId, fields, checkInDate, confirmed) {
  if (!confirmed) throw Error('Confirm you sent the response outside ExceptionOS.');
  if (replyId !== goal.replies[0]?.id) throw Error('Use the latest reply to record a new response.');
  checkSendable(fields, confirmed);
  let next = saveResponseDraft(goal, replyId, fields);
  next = setFollowUp(next, 'waiting', checkInDate);
  const sentAt = now();
  next = replaceReply(next, replyId, reply => ({ ...reply, sentResponses: [{ ...reply.draft, sentAt }, ...reply.sentResponses], draft: null }));
  return { ...next, planNeedsRefresh: goal.steps.length > 0, followUp: { ...next.followUp, lastSentAt: sentAt }, updates: [{ id: uid(), body: 'You recorded a response as sent. Waiting for a reply.', kind: 'milestone', createdAt: sentAt }, ...next.updates] };
}

export function setLastContact(goal, fields) {
  active(goal);
  if (fields.lastContactOn && !validDay(fields.lastContactOn)) throw Error('Choose a valid date for your last contact.');
  return { ...goal, outreach: { ...goal.outreach, lastContact: text(fields.lastContact, 3000), lastContactOn: validDay(fields.lastContactOn) } };
}

export function saveNudgeDraft(goal, fields) {
  active(goal);
  const draft = normalizeDraft({ ...fields, updatedAt: now(), sentAt: null });
  if (!draft) throw Error('Write a follow-up before saving it.');
  return { ...goal, outreach: { ...goal.outreach, draft } };
}

export function recordNudgeSent(goal, fields, checkInDate, confirmed) {
  checkSendable(fields, confirmed);
  let next = saveNudgeDraft(goal, fields);
  next = setFollowUp(next, 'waiting', checkInDate);
  const sentAt = now();
  return {
    ...next, planNeedsRefresh: goal.steps.length > 0, followUp: { ...next.followUp, lastSentAt: sentAt },
    outreach: { ...next.outreach, draft: null, sent: [{ ...next.outreach.draft, sentAt }, ...next.outreach.sent].slice(0, 20) },
    updates: [{ id: uid(), body: 'You recorded a follow-up as sent. Waiting for a reply.', kind: 'milestone', createdAt: sentAt }, ...next.updates]
  };
}

export function followUpStatus(goal, today = localDay()) {
  if (goal.status === 'resolved') return 'Resolved';
  if (goal.followUp.checkInDate && goal.followUp.checkInDate <= today) return 'Follow-up due';
  return goal.followUp.stage === 'waiting' ? 'Waiting for a reply' : 'Needs your action';
}

export function attentionGoals(goals, today = localDay()) {
  return goals.filter(goal => goal.status !== 'resolved' && (goal.followUp.stage === 'needs_action' || (goal.followUp.checkInDate && goal.followUp.checkInDate <= today)))
    .sort((a, b) => {
      const dueA = Boolean(a.followUp.checkInDate && a.followUp.checkInDate <= today);
      const dueB = Boolean(b.followUp.checkInDate && b.followUp.checkInDate <= today);
      return Number(dueB) - Number(dueA) || (a.followUp.checkInDate || '9999').localeCompare(b.followUp.checkInDate || '9999');
    });
}

// Bounded, oldest-first record of what was received and sent, so later model calls keep earlier facts and commitments.
export function conversation(goal, { excludeReplyId = null, limit = 8 } = {}) {
  const events = [];
  for (const reply of goal.replies) {
    if (reply.id !== excludeReplyId) events.push({ type: 'received', on: replyDay(reply) || null, from: reply.sender, text: clip(reply.sourceText, 1200) });
    for (const sent of reply.sentResponses) events.push({ type: 'you_sent', on: sent.sentAt?.slice(0, 10) || null, text: clip(sent.body, 900) });
  }
  const outreach = goal.outreach || normalizeOutreach();
  if (outreach.lastContact) events.push({ type: 'your_last_contact', on: outreach.lastContactOn || null, text: clip(outreach.lastContact, 900) });
  for (const sent of outreach.sent) events.push({ type: 'you_sent_follow_up', on: sent.sentAt?.slice(0, 10) || null, text: clip(sent.body, 900) });
  return events.sort((a, b) => (a.on || '').localeCompare(b.on || '')).slice(-limit);
}

const completedActions = goal => goal.steps.filter(step => step.completed).map(step => step.title).slice(0, 10);

export function replyRequest(goal, replyId, extraContext = '') {
  const reply = goal.replies.find(item => item.id === replyId);
  if (!reply) throw Error('Save a reply before asking Anna to work with it.');
  return {
    title: goal.title, desiredOutcome: goal.outcome, context: goal.context, alreadyTried: goal.attempted, organization: goal.organization,
    reply: { sourceText: reply.sourceText, sender: reply.sender, receivedOn: reply.receivedOn || null },
    earlierConversation: conversation(goal, { excludeReplyId: reply.id }), completedActions: completedActions(goal),
    recentUpdates: goal.updates.filter(item => item.kind !== 'milestone').slice(0, 5).map(item => ({ note: item.body, evidenceUrl: item.url || '' })),
    analysis: reply.analysis, lastSentResponse: reply.sentResponses[0]?.body || '', extraContext: text(extraContext, 2000)
  };
}

export function nudgeRequest(goal, extraContext = '', today = localDay()) {
  return {
    title: goal.title, desiredOutcome: goal.outcome, context: goal.context, alreadyTried: goal.attempted, organization: goal.organization, today,
    lastContact: { text: goal.outreach.lastContact, on: goal.outreach.lastContactOn || null },
    conversation: conversation(goal), completedActions: completedActions(goal),
    recentUpdates: goal.updates.filter(item => item.kind !== 'milestone').slice(0, 5).map(item => ({ note: item.body, evidenceUrl: item.url || '' })),
    extraContext: text(extraContext, 2000)
  };
}
