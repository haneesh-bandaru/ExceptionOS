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

function normalizeGoal(goal) {
  if (!goal || typeof goal !== 'object' || !goal.id || !goal.title) return null;
  const steps = Array.isArray(goal.steps) ? goal.steps.map((step, index) => ({
    id: text(step.id, 120) || `${goal.id}-step-${index + 1}`,
    title: text(step.title, 240),
    why: text(step.why, 500),
    doneWhen: text(step.doneWhen, 500),
    sourceUrl: safeUrl(step.sourceUrl),
    completed: Boolean(step.completed),
    completedAt: step.completedAt || null
  })).filter(step => step.title) : [];
  const updates = Array.isArray(goal.updates) ? goal.updates.map(update => ({
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
    summary: text(goal.summary, 900), questions: Array.isArray(goal.questions) ? goal.questions.map(q => text(q, 300)).filter(Boolean).slice(0, 4) : [],
    steps, updates, createdAt: goal.createdAt || now(), updatedAt: goal.updatedAt || now(),
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
    status: 'active', summary: '', questions: [], steps: [], updates: [], createdAt, updatedAt: createdAt
  });
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
  const suppliedUrls = new Set(`${goal.outcome} ${goal.context} ${goal.attempted}`.match(/https:\/\/[^\s<>"']+/g) || []);
  const steps = plan.steps.slice(0, 6).map(step => ({
    id: id(), title: text(step.title, 240), why: text(step.why, 500),
    doneWhen: text(step.doneWhen, 500), sourceUrl: suppliedUrls.has(step.sourceUrl) ? safeUrl(step.sourceUrl) : '', completed: false, completedAt: null
  })).filter(step => step.title && step.doneWhen);
  if (!steps.length) throw Error('Anna did not return an actionable step. Please add more context and retry.');
  return normalizeGoal({
    ...goal, summary: text(plan.summary, 900),
    questions: plan.questions.map(q => text(q, 300)).filter(Boolean).slice(0, 4), steps,
    updates: [{ id: id(), kind: 'milestone', body: 'Anna created the first action plan.', createdAt: now() }, ...goal.updates]
  });
}

export function toggleStep(goal, stepId) {
  return normalizeGoal({ ...goal, steps: goal.steps.map(step => step.id === stepId
    ? { ...step, completed: !step.completed, completedAt: step.completed ? null : now() }
    : step) });
}

export function addUpdate(goal, body, url = '') {
  const cleanBody = text(body, 1200);
  if (!cleanBody) throw Error('Write an update before saving.');
  const cleanUrl = safeUrl(url);
  if (url && !cleanUrl) throw Error('Evidence links must start with https://');
  return normalizeGoal({ ...goal, updates: [{ id: id(), kind: cleanUrl ? 'evidence' : 'note', body: cleanBody, url: cleanUrl, createdAt: now() }, ...goal.updates] });
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

