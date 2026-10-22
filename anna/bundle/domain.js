import { addReply, normalizeFollowUp, normalizeOutreach, normalizeReplies, setLastContact } from './followup.js';

export const WORKSPACE_VERSION = 1;
export const WORKSPACE_KEY = 'exceptionos.workspace.v1';

const text = (value, limit = 2000) => String(value ?? '').trim().slice(0, limit);
const now = () => new Date().toISOString();
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function emptyWorkspace() {
  return { version: WORKSPACE_VERSION, goals: [], activeGoalId: null };
}

export function normalizeWorkspace(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.goals)) return emptyWorkspace();
  const goals = input.goals.map(normalizeGoal).filter(Boolean);
  const activeGoalId = goals.some(goal => goal.id === input.activeGoalId)
    ? input.activeGoalId
    : goals[0]?.id || null;
  return { version: WORKSPACE_VERSION, goals, activeGoalId };
}

export function unwrapStorageValue(stored) {
  return stored && Object.hasOwn(stored, 'value') ? stored.value : stored;
}

function normalizeGoal(goal) {
  if (!goal || typeof goal !== 'object' || !goal.id || !goal.title) return null;
  const steps = Array.isArray(goal.steps) ? goal.steps.filter(step => step && typeof step === 'object').map((step, index) => ({
    id: text(step.id, 120) || `${goal.id}-step-${index + 1}`,
    title: text(step.title, 240),
    why: text(step.why, 500),
    doneWhen: text(step.doneWhen, 500),
    sourceUrl: safeUrl(step.sourceUrl),
    completed: Boolean(step.completed),
    completedAt: step.completedAt || null
  })).filter(step => step.title) : [];
  const updates = Array.isArray(goal.updates) ? goal.updates.filter(update => update && typeof update === 'object').map(update => ({
    id: text(update.id, 120) || id(),
    body: text(update.body, 1200),
    createdAt: update.createdAt || now(),
    kind: ['note', 'evidence', 'milestone'].includes(update.kind) ? update.kind : 'note',
    url: safeUrl(update.url)
  })).filter(update => update.body) : [];
  return {
    id: text(goal.id, 120), title: text(goal.title, 160), outcome: text(goal.outcome, 800),
    context: text(goal.context, 2400), attempted: text(goal.attempted, 1200),
    organization: text(goal.organization, 160), category: text(goal.category, 80) || 'Other',
    deadline: text(goal.deadline, 40), status: goal.status === 'resolved' ? 'resolved' : 'active',
    followUp: normalizeFollowUp(goal.followUp), replies: normalizeReplies(goal.replies), outreach: normalizeOutreach(goal.outreach),
    summary: text(goal.summary, 900), changeSummary: text(goal.changeSummary, 900),
    questions: Array.isArray(goal.questions) ? goal.questions.map(q => text(q, 300)).filter(Boolean).slice(0, 4) : [],
    planHistory: Array.isArray(goal.planHistory) ? goal.planHistory.filter(snapshot => snapshot && typeof snapshot === 'object').slice(0, 5).map(snapshot => ({
      savedAt: text(snapshot.savedAt, 40), summary: text(snapshot.summary, 900),
      steps: Array.isArray(snapshot.steps) ? snapshot.steps.filter(step => step && typeof step === 'object').slice(0, 100).map(step => ({
        title: text(step.title, 240), completed: Boolean(step.completed), doneWhen: text(step.doneWhen, 500)
      })) : []
    })) : [],
    steps, updates, planNeedsRefresh: Boolean(goal.planNeedsRefresh), titleFromSource: Boolean(goal.titleFromSource), createdAt: goal.createdAt || now(), updatedAt: goal.updatedAt || now(),
    resolvedAt: goal.resolvedAt || null, resolution: text(goal.resolution, 1200)
  };
}

export function createGoal(fields) {
  const title = text(fields.title, 160);
  const outcome = text(fields.outcome, 800);
  if (!title) throw Error('Give this goal a short title.');
  if (!outcome) throw Error('Describe the outcome you want.');
  const createdAt = now();
  return normalizeGoal({
    id: id(), title, outcome, context: fields.context, attempted: fields.attempted,
    organization: fields.organization, category: fields.category, deadline: fields.deadline,
    status: 'active', summary: '', questions: [], steps: [], updates: [], planNeedsRefresh: false, createdAt, updatedAt: createdAt
  });
}

// One-step entry: a goal created from a pasted message, or from the user's last unanswered contact.
export function quickStartGoal(fields, defaults = {}) {
  const waiting = fields.mode === 'waiting';
  const source = text(waiting ? fields.lastContact : fields.sourceText, 6000);
  if (!source) throw Error(waiting ? 'Describe your last message before drafting a follow-up.' : 'Paste the message before continuing.');
  const firstLine = source.split(/\n/).map(line => line.trim()).find(Boolean) || '';
  const title = text(fields.organization, 160) || text(fields.sender, 160) || (firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine);
  let goal = createGoal({
    title: title || defaults.title || 'Follow-up', outcome: text(fields.outcome, 800) || defaults.outcome || 'Respond clearly and move this forward.',
    organization: fields.organization, category: 'Other'
  });
  goal = waiting
    ? setLastContact(goal, { lastContact: source, lastContactOn: fields.lastContactOn })
    : addReply(goal, { sourceText: source, sender: fields.sender, receivedOn: fields.receivedOn });
  return normalizeGoal({ ...goal, titleFromSource: !text(fields.organization, 160) && !text(fields.sender, 160) });
}

export function upsertGoal(workspace, goal) {
  const clean = normalizeGoal({ ...goal, updatedAt: now() });
  if (!clean) throw Error('This goal is incomplete.');
  const goals = workspace.goals.some(item => item.id === clean.id)
    ? workspace.goals.map(item => item.id === clean.id ? clean : item)
    : [clean, ...workspace.goals];
  return { ...workspace, goals, activeGoalId: clean.id };
}

export function applyPlan(goal, plan) {
  if (!plan || typeof plan.summary !== 'string' || !Array.isArray(plan.steps) || !Array.isArray(plan.questions)) {
    throw Error('Anna returned an unexpected plan. Please try again.');
  }
  const suppliedUrls = new Set(`${goal.outcome} ${goal.context} ${goal.attempted} ${goal.updates.map(update => `${update.body} ${update.url || ''}`).join(' ')} ${(goal.replies || []).slice(0, 4).map(reply => reply.sourceText).join(' ')} ${goal.outreach?.lastContact || ''}`.match(/https:\/\/[^\s<>"']+/g) || []);
  const completed = goal.steps.filter(step => step.completed);
  const completedTitles = new Set(completed.map(step => step.title.toLocaleLowerCase()));
  const steps = plan.steps.slice(0, 6).filter(step => step && typeof step === 'object').map(step => ({
    id: id(), title: text(step.title, 240), why: text(step.why, 500),
    doneWhen: text(step.doneWhen, 500), sourceUrl: suppliedUrls.has(step.sourceUrl) ? safeUrl(step.sourceUrl) : '', completed: false, completedAt: null
  })).filter(step => step.title && step.doneWhen && !completedTitles.has(step.title.toLocaleLowerCase()));
  if (!steps.length) throw Error('Anna did not return an actionable step. Please add more context and retry.');
  return normalizeGoal({
    ...goal, summary: text(plan.summary, 900),
    changeSummary: text(plan.changeSummary, 900),
    questions: plan.questions.map(q => text(q, 300)).filter(Boolean).slice(0, 4),
    steps: [...completed, ...steps], planNeedsRefresh: false,
    planHistory: goal.steps.length ? [{ savedAt: now(), summary: goal.summary, steps: goal.steps }, ...(goal.planHistory || [])].slice(0, 5) : goal.planHistory,
    updates: [{ id: id(), kind: 'milestone', body: goal.steps.length ? 'Reviewed and applied an updated Anna plan. Completed actions were retained.' : 'Anna created the first action plan.', createdAt: now() }, ...goal.updates]
  });
}

export function toggleStep(goal, stepId) {
  if (goal.status === 'resolved') throw Error('Reopen this goal before changing its checklist.');
  return normalizeGoal({ ...goal, steps: goal.steps.map(step => step.id === stepId
    ? { ...step, completed: !step.completed, completedAt: step.completed ? null : now() }
    : step) });
}

export function addUpdate(goal, body, url = '') {
  const cleanBody = text(body, 1200);
  if (goal.status === 'resolved') throw Error('Reopen this goal before adding updates.');
  if (!cleanBody) throw Error('Write an update before saving.');
  const cleanUrl = safeUrl(url);
  if (url && !cleanUrl) throw Error('Evidence links must start with https://');
  return normalizeGoal({ ...goal, planNeedsRefresh: goal.steps.length > 0, updates: [{ id: id(), kind: cleanUrl ? 'evidence' : 'note', body: cleanBody, url: cleanUrl, createdAt: now() }, ...goal.updates] });
}

export function planRequest(goal) {
  const clean = normalizeGoal(goal);
  return {
    title: clean.title,
    desiredOutcome: clean.outcome,
    context: clean.context,
    alreadyTried: clean.attempted,
    organization: clean.organization,
    category: clean.category,
    targetDate: clean.deadline || null,
    currentPlan: clean.steps.map(step => ({ title: step.title, doneWhen: step.doneWhen, completed: step.completed })),
    outstandingQuestions: clean.questions,
    followUp: clean.followUp,
    lastContact: clean.outreach.lastContact ? { text: clean.outreach.lastContact, on: clean.outreach.lastContactOn || null } : null,
    followUpsSent: clean.outreach.sent.slice(0, 3).map(item => ({ body: item.body, sentOn: item.sentAt?.slice(0, 10) || null })),
    recentReplies: clean.replies.slice(0, 4).map(reply => ({ sourceText: reply.sourceText, sender: reply.sender, receivedOn: reply.receivedOn, lastSentResponse: reply.sentResponses[0]?.body || '' })),
    recentUpdates: clean.updates.filter(update => update.kind !== 'milestone').slice(0, 10).map(update => ({
      note: update.body,
      kind: update.kind,
      evidenceUrl: update.url || '',
      recordedAt: update.createdAt
    }))
  };
}

// Replace a title derived from the message's first line with Anna's short label, once.
export function applySuggestedTitle(goal, title) {
  const clean = text(title, 80);
  return goal.titleFromSource && clean ? normalizeGoal({ ...goal, title: clean, titleFromSource: false }) : goal;
}

export function resolveGoal(goal, resolution) {
  const clean = text(resolution, 1200);
  if (!clean) throw Error('Record what happened before closing the goal.');
  return normalizeGoal({ ...goal, status: 'resolved', resolution: clean, resolvedAt: now() });
}

export function reopenGoal(goal) {
  return normalizeGoal({ ...goal, status: 'active', resolvedAt: null });
}

export function progress(goal) {
  if (!goal.steps.length) return 0;
  return Math.round(goal.steps.filter(step => step.completed).length / goal.steps.length * 100);
}

export function nextStep(goal) {
  return goal.steps.find(step => !step.completed) || null;
}

export function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

