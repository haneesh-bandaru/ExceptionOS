import { platform } from './platform.js';
import { addUpdate, applyPlan, applySuggestedTitle, createGoal, emptyWorkspace, nextStep, normalizeWorkspace, progress, quickStartGoal, reopenGoal, resolveGoal, toggleStep, upsertGoal } from './domain.js';
import { addReply, applyReplyAnalysis, followUpStatus, localDay, missingPlaceholders, recordNudgeSent, recordResponseSent, saveNudgeDraft, saveResponseDraft, setFollowUp, setLastContact } from './followup.js';
import { renderAttention, renderFollowupSummary, renderReplies } from './followup-view.js';
import { getLang, locale, setLang, t } from './i18n.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let workspace = emptyWorkspace();
let view = 'home';
let busy = false;
let busyMessage = '';
let goalTab = 'plan';
let selectedReplyId = null;
let replyError = '';
let nudgeError = '';
let modal = null;
let modalReturn = '';
let savingMessage = '';
let loadError = '';
let planError = '';
let quickMode = 'message';
let resolutionDraft = '';
let toastTimer;
const drafts = new Map();
// Generated plan replacements awaiting review, kept per goal so navigation does not discard them.
const proposals = new Map();

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const fmt = value => Number.isNaN(new Date(value).getTime()) ? t('Unknown date') : new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const activeGoal = () => workspace.goals.find(goal => goal.id === workspace.activeGoalId) || null;
const activeReply = goal => goal?.replies.find(reply => reply.id === selectedReplyId) || goal?.replies[0];
const formKey = form => form.id === 'quick-form' ? `quick-form:${quickMode}` : `${form.id}:${activeGoal()?.id || 'new'}:${form.dataset.reply || ''}`;
const announce = (message, kind = '') => { clearTimeout(toastTimer); toast.textContent = t(message); toast.className = `toast show ${kind}`; toastTimer = setTimeout(() => toast.className = 'toast', 5000); };
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';

async function persist(next, message, pendingMessage = 'Saving…') {
  const previous = workspace;
  workspace = normalizeWorkspace(next);
  savingMessage = pendingMessage;
  render();
  announce(pendingMessage);
  try {
    workspace = await platform.save(workspace);
    savingMessage = '';
    render();
    if (message) announce(message);
  } catch (error) {
    workspace = previous;
    savingMessage = '';
    render();
    throw Error(`${t('Could not save to Anna. Your last loaded state is shown. Please retry.')} ${error.message || ''}`);
  }
}

function shell(content) {
  return `<div class="shell" ${modal ? 'inert' : ''}>
    <aside class="rail">
      <div class="rail-top"><button class="brand" data-action="home"><span class="mark">E</span><span>ExceptionOS</span></button><button class="lang-toggle" data-action="lang" lang="${getLang() === 'zh' ? 'en' : 'zh'}" aria-label="${getLang() === 'zh' ? 'Switch to English' : '切换到中文'}">${getLang() === 'zh' ? 'EN' : '中文'}</button></div>
      <button class="new-goal" data-action="new">${t('+ New goal')}</button>
      <label class="mobile-goals">${t('Switch goal')}<select id="goal-switch"><option value="">${t('Choose a goal…')}</option>${workspace.goals.map(goal => `<option value="${esc(goal.id)}" ${goal.id === workspace.activeGoalId && view === 'goal' ? 'selected' : ''}>${esc(goal.title)}${goal.status === 'resolved' ? ` · ${t('Resolved')}` : ''}</option>`).join('')}</select></label>
      <nav aria-label="${esc(t('Goals'))}">
        <p class="rail-label">${t('YOUR GOALS')}</p>
        ${workspace.goals.length ? workspace.goals.map(goal => `<button class="goal-link ${goal.id === workspace.activeGoalId && view === 'goal' ? 'active' : ''}" data-goal="${esc(goal.id)}"><span>${esc(goal.title)}</span><small>${goal.status === 'resolved' ? t('Resolved') : proposals.has(goal.id) ? t('Plan update to review') : goal.steps.length ? esc(t('{percent}% complete', { percent: progress(goal) })) : t(followUpStatus(goal))}</small></button>`).join('') : `<p class="rail-empty">${t('Your active goals will appear here.')}</p>`}
      </nav>
      <div class="rail-foot"><span class="secure-dot"></span><span>${t('Private Anna storage')}</span></div>
    </aside>
    <main>${content}</main>
  </div>${savingMessage || busy ? `<div class="sync-indicator" role="status"><span class="spinner"></span>${esc(t(savingMessage || busyMessage || 'Anna is preparing your plan…'))}</div>` : ''}${renderModal()}`;
}

function renderModal() {
  if (!modal) return '';
  const goal = activeGoal();
  const details = {
    replan: { title: t('Update the plan with Anna?'), body: t('Anna will use your goal, recent notes, evidence links, saved replies, and completed actions to suggest remaining steps. You will review the changes before applying them. Your current plan stays saved.'), confirm: t('Generate updated plan') },
    delete: { title: t('Delete this goal?'), body: t('This permanently removes “{title}” and its saved history from your Anna workspace.', { title: goal?.title || t('this goal') }), confirm: t('Delete goal') },
    resolve: { title: t('Close this goal as resolved?'), body: t('Record the outcome so you can understand what worked later.'), confirm: t('Close as resolved') }
  }[modal];
  return `<div class="modal-backdrop" role="presentation"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-body">
    <span class="eyebrow">${t('CONFIRM ACTION')}</span><h2 id="modal-title">${esc(details.title)}</h2><p id="modal-body">${esc(details.body)}</p>
    ${modal === 'resolve' ? `<label>${t('What happened?')}<textarea id="resolution-input" maxlength="1200" required placeholder="${esc(t('Record the result…'))}">${esc(resolutionDraft)}</textarea></label>` : ''}
    ${modal === 'replan' ? `<label class="consent"><input type="checkbox" id="replan-consent"><span>${t('Allow Anna and its configured model provider to process this goal and its recent updates.')}</span></label>` : ''}
    <div class="modal-actions"><button class="secondary" data-action="modal-cancel">${t('Cancel')}</button><button class="primary ${modal === 'delete' ? 'danger' : ''}" data-action="modal-confirm">${esc(details.confirm)}</button></div>
  </section></div>`;
}

const SAMPLE = 'Hi Priya,\n\nThanks for applying for the Content Marketing Associate role. Before we can move you to the interview stage, please send two examples of campaigns you worked on and confirm your availability for a 30-minute call next week.\n\nPlease reply by Friday.\n\nBest,\nDaniel, Talent Team';

function renderQuick() {
  const waiting = quickMode === 'waiting';
  return `<div class="mini-head"><span>${t('Start here')}</span><span class="anna-pill">${t('Powered by Anna')}</span></div>
    <div class="quick-modes" role="group" aria-label="${esc(t('What happened?'))}"><button type="button" data-quick="message" aria-pressed="${!waiting}">${t('I got a message')}</button><button type="button" data-quick="waiting" aria-pressed="${waiting}">${t('I haven’t heard back')}</button></div>
    <form id="quick-form" class="quick-form">
      ${waiting ? `<label>${t('Who are you waiting on? (optional)')}<input name="organization" maxlength="160" placeholder="${esc(t('e.g. Acme recruiting team'))}"></label>
        <label>${t('What did you last send them?')}<textarea name="lastContact" maxlength="3000" required placeholder="${esc(t('Paste your last message, or summarize it: “Applied for the analyst role on Oct 2 and sent one follow-up.”'))}"></textarea></label>
        <label>${t('When did you send it? (optional)')}<input type="date" name="lastContactOn" max="${localDay()}"></label>`
      : `<label>${t('Paste the message')}<textarea name="sourceText" maxlength="6000" required placeholder="${esc(t('Paste an email or chat message from a recruiter, school, landlord, office, or client. Remove sensitive identifiers first.'))}"></textarea></label>
        <button type="button" class="text-button sample-button" data-action="sample">${t('Try it with a sample message')}</button>`}
      <label>${t('What do you want to happen? (optional)')}<input name="outcome" maxlength="800" placeholder="${esc(t('e.g. Get an interview date'))}"></label>
      <label class="consent"><input type="checkbox" name="consent"><span>${waiting ? t('Allow Anna and its model provider to process these details and draft a follow-up. Nothing is sent.') : t('Allow Anna and its model provider to read this message and draft a reply. Nothing is sent.')}</span></label>
      <button class="primary wide" type="submit">${waiting ? t('Draft my follow-up') : t('Read it and draft my reply')}</button>
      <p class="muted">${t('Saved privately in your Anna workspace. You edit and send the reply yourself.')}</p>
    </form>`;
}

function renderHome() {
  const active = workspace.goals.filter(goal => goal.status === 'active');
  const resolved = workspace.goals.filter(goal => goal.status === 'resolved');
  const latest = active[0] || resolved[0];
  return shell(`<section class="home hero-grid">
    <div class="hero-copy">
      <span class="eyebrow">${t('ANY MESSAGE THAT NEEDS A REPLY')}</span>
      <h1>${t('Know what they want.')}<br><em>${t('Reply in a minute.')}</em></h1>
      <p>${t('Paste a message from a recruiter, school, landlord, government office, or client. Anna finds what they are asking for and any deadline, then drafts a reply you can edit. Still waiting to hear back? Draft a polite follow-up instead.')}</p>
      <div class="hero-actions">${latest ? `<button class="secondary" data-goal="${esc(latest.id)}">${t('Continue last goal')}</button>` : ''}<button class="secondary" data-action="new">${t('Start with a goal')}</button></div>
      <p class="muted plan-hint">${t('Bigger situation? Start with a goal and Anna builds a short action plan.')}</p>
      <div class="trust"><span>✓ ${t('No separate account')}</span><span>✓ ${t('Saved privately in Anna')}</span><span>✓ ${t('Nothing is sent for you')}</span></div>
    </div>
    <div class="hero-card quick-card">${renderQuick()}</div>
  </section>
  ${renderAttention(workspace.goals)}<section class="stats"><div><strong>${active.length}</strong><span>${t('Active goals')}</span></div><div><strong>${resolved.length}</strong><span>${t('Resolved')}</span></div><div><strong>${workspace.goals.reduce((sum, goal) => sum + goal.replies.reduce((count, reply) => count + reply.sentResponses.length, 0) + goal.outreach.sent.length, 0)}</strong><span>${t('Replies and follow-ups sent')}</span></div></section>`);
}

function renderNew() {
  const areas = ['Work', 'Education', 'Housing', 'Money', 'Administration', 'Creator', 'Other'];
  return shell(`<section class="form-page narrow">
    <button class="back" data-action="home">${t('← Back')}</button>
    <span class="eyebrow">${t('NEW GOAL')}</span><h1>${t('What needs to move?')}</h1>
    <p class="lead">${t('Start with the result. You can add detail now or refine it with Anna later.')}</p>
    <form id="goal-form" class="goal-form">
      <label>${t('Short title')} <input name="title" maxlength="160" required placeholder="${esc(t('e.g. Get a decision on my application'))}"></label>
      <label>${t('What outcome do you want?')} <textarea name="outcome" maxlength="800" required placeholder="${esc(t('Describe what done looks like.'))}"></textarea></label>
      <div class="two-col"><label>${t('Area')} <select name="category" aria-label="${esc(t('Area'))}">${areas.map(area => `<option value="${area}">${t(area)}</option>`).join('')}</select></label><label>${t('Organization (optional)')} <input name="organization" maxlength="160" placeholder="${esc(t('Who is involved?'))}"></label></div>
      <details class="more-fields"><summary>${t('Add more detail (optional)')}</summary>
        <label>${t('What is happening?')} <textarea name="context" maxlength="2400" placeholder="${esc(t('Dates, replies, constraints, and useful facts. Do not include passwords or sensitive IDs.'))}"></textarea></label>
        <label>${t('What have you tried?')} <textarea name="attempted" maxlength="1200" placeholder="${esc(t('Messages sent, forms filed, people contacted…'))}"></textarea></label>
        <label class="date-label">${t('Target date (optional)')} <input type="date" name="deadline"></label>
      </details>
      <div class="privacy-note"><span>◈</span><p><strong>${t('Private by design.')}</strong> ${t('Your workspace is stored in your Anna account. You choose when Anna’s model provider processes it to plan, analyze a reply, or draft a response.')}</p></div>
      <button class="primary wide" type="submit">${t('Create goal')}</button>
    </form>
  </section>`);
}

function renderGoal(goal) {
  if (!goal) return renderHome();
  const done = progress(goal);
  const next = nextStep(goal);
  const resolved = goal.status === 'resolved';
  const proposal = proposals.get(goal.id);
  return shell(`<section class="workspace-page">
    <header class="goal-head"><div><span class="eyebrow">${goal.category !== 'Other' ? `${esc(t(goal.category))} · ` : ''}${resolved ? t('RESOLVED') : t('ACTIVE GOAL')}</span><h1>${esc(goal.title)}</h1><p>${esc(goal.outcome)}</p></div><button class="more" data-action="delete" aria-label="${esc(t('Delete goal'))}">${t('Delete')}</button></header>
    ${renderFollowupSummary(goal)}
    <div class="goal-tabs" role="group" aria-label="${esc(t('Goal workspace'))}"><button data-action="open-replies" aria-pressed="${goalTab === 'replies'}">${t('Replies & follow-ups')}${goal.replies.length ? ` (${goal.replies.length})` : ''}</button><button data-action="open-plan" aria-pressed="${goalTab === 'plan'}">${t('Plan & progress')}</button></div>
    ${goalTab === 'plan' && goal.steps.length ? `<div class="progress-wrap"><div><span>${t('Checklist progress')}</span><strong>${done}%</strong></div><div class="progress-track"><i style="width:${done}%"></i></div></div>` : ''}
    ${resolved ? `<section class="resolved-card"><span>✓</span><div><p>${goal.resolvedAt ? esc(t('Goal resolved on {date}', { date: fmt(goal.resolvedAt) })) : t('Goal resolved')}</p><h2>${esc(goal.resolution)}</h2></div><button class="secondary" data-action="reopen">${t('Reopen')}</button></section>` : ''}
    ${goalTab === 'replies' ? renderReplies(goal, selectedReplyId, replyError, nudgeError) : `${planError ? `<section class="error-notice" role="alert"><strong>${t('Anna could not finish the plan.')}</strong><p>${esc(t(planError))}</p><p>${t('Your saved goal, plan, and notes are unchanged.')} ${goal.steps.length ? t('Use Rebuild with Anna to retry.') : t('Confirm processing below and try again.')}</p></section>` : ''}
    ${proposal ? renderPlanPreview(proposal) : ''}
    ${!goal.steps.length ? `${!resolved ? `${renderPlanStart(goal)}<button class="resolve-button" data-action="resolve">${t('Close as resolved')}</button>` : renderUpdates(goal)}` : `<div class="workspace-grid"><div>
      ${goal.summary ? `<section class="panel plan-summary"><span class="eyebrow">${t('PLAN AT A GLANCE')}</span><p>${esc(goal.summary)}</p>${goal.changeSummary ? `<strong>${t('What changed')}</strong><p>${esc(goal.changeSummary)}</p>` : ''}</section>` : ''}
      ${next && !resolved ? `<section class="next-card"><span class="eyebrow">${t('NEXT ACTION')}</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><div class="done-when"><strong>${t('Done when')}</strong><span>${esc(next.doneWhen)}</span></div><button class="primary" data-step="${esc(next.id)}">${t('Mark complete')}</button></section>` : ''}
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">${t('ACTION PLAN')}</span><h2>${esc(t('{done} of {total} completed', { done: goal.steps.filter(s => s.completed).length, total: goal.steps.length }))}</h2></div>${!resolved ? `<button class="text-button" data-action="replan">${t('Rebuild with Anna')}</button>` : ''}</div>
        <div class="steps">${goal.steps.map((step, index) => `<article class="step ${step.completed ? 'complete' : ''}"><button class="check" data-step="${esc(step.id)}" ${resolved ? `disabled aria-disabled="true" title="${esc(t('Reopen this goal before changing its checklist.'))}"` : ''} aria-label="${step.completed ? t('Reopen step') : t('Complete step')}">${step.completed ? '✓' : index + 1}</button><div><h3>${esc(step.title)}</h3><p>${esc(step.why)}</p><small>${t('DONE WHEN')} · ${esc(step.doneWhen)}</small>${step.sourceUrl ? `<a href="${esc(step.sourceUrl)}" target="_blank" rel="noopener">${t('User-provided source ↗')}</a>` : ''}</div></article>`).join('')}</div>
      </section>
    </div><aside>
      ${goal.planNeedsRefresh && !resolved ? `<section class="refresh-notice" role="status"><span>↻</span><div><strong>${t('New context is saved.')}</strong><p>${t('The current plan and questions have not changed yet. Rebuild with Anna to include your latest update.')}</p><button class="secondary" data-action="replan">${t('Rebuild plan with Anna')}</button></div></section>` : ''}
      ${goal.questions.length ? `<section class="panel questions"><span class="eyebrow">${t('ANNA STILL WONDERS')}</span><ul>${goal.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul><p>${t('Answer in the progress log. After saving, use “Rebuild plan with Anna” to update the plan and questions.')}</p></section>` : ''}
      ${renderUpdates(goal)}
      ${goal.planHistory.length ? `<details class="panel plan-history"><summary>${esc(t('Previous plans ({count})', { count: goal.planHistory.length }))}</summary>${goal.planHistory.map(snapshot => `<article><small>${fmt(snapshot.savedAt)}</small><p>${esc(snapshot.summary)}</p><ul>${snapshot.steps.map(step => `<li>${step.completed ? '✓ ' : ''}${esc(step.title)}</li>`).join('')}</ul></article>`).join('')}</details>` : ''}
      ${!resolved ? `<button class="resolve-button" data-action="resolve">${t('Close as resolved')}</button>` : ''}
    </aside></div>`}`}
  </section>`);
}

function renderPlanPreview(goal) {
  return `<section class="panel plan-preview" aria-label="${esc(t('Review updated plan'))}"><span class="eyebrow">${t('REVIEW BEFORE APPLYING')}</span><h2>${t('Your updated plan is ready')}</h2><p>${esc(goal.changeSummary || goal.summary)}</p><p>${esc(t('{count} completed actions retained. Your current plan remains saved until you apply this update.', { count: goal.steps.filter(step => step.completed).length }))}</p><ol>${goal.steps.filter(step => !step.completed).map(step => `<li><strong>${esc(step.title)}</strong><p>${esc(step.why)}</p><small>${t('Done when:')} ${esc(step.doneWhen)}</small></li>`).join('')}</ol><h3>${t('Remaining questions')}</h3>${goal.questions.length ? `<ul>${goal.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : `<p>${t('No further questions from Anna.')}</p>`}<div class="preview-actions"><button class="primary" data-action="apply-plan">${t('Apply updated plan')}</button><button class="secondary" data-action="discard-plan">${t('Keep current plan')}</button></div></section>`;
}

function renderPlanStart(goal) {
  return `<div class="preplan"><section class="plan-start"><div class="plan-symbol">✦</div><span class="eyebrow">${t('ANNA PLANNING')}</span><h2>${t('Turn this goal into the first move.')}</h2><p>${t('Anna will read the information below and create 3–6 ordered actions. Review every suggestion before acting.')}</p>
    <dl><div><dt>${t('Desired outcome')}</dt><dd>${esc(goal.outcome)}</dd></div>${goal.context ? `<div><dt>${t('Context')}</dt><dd>${esc(goal.context)}</dd></div>` : ''}${goal.attempted ? `<div><dt>${t('Already tried')}</dt><dd>${esc(goal.attempted)}</dd></div>` : ''}${goal.updates.some(update => update.kind !== 'milestone') || goal.replies.length || goal.outreach.lastContact ? `<div><dt>${t('Latest context')}</dt><dd>${t('Your recent notes, evidence links, latest saved replies, and follow-ups will also be included.')}</dd></div>` : ''}</dl>
    <label class="consent"><input type="checkbox" id="ai-consent"><span><strong>${t('Build this plan with Anna')}</strong><small>${t('I understand these goal details will be processed by Anna and its configured model provider.')}</small></span></label>
    <button class="primary wide" data-action="plan" ${busy ? 'disabled' : ''}>${busy ? `<span class="spinner"></span> ${t('Anna is building your plan…')}` : t('Build my action plan')}</button>
  </section>${renderUpdates(goal)}</div>`;
}

function renderUpdates(goal) {
  const kinds = { note: t('note'), evidence: t('evidence'), milestone: t('milestone') };
  return `<section class="panel updates"><span class="eyebrow">${t('PROGRESS LOG')}</span>
    ${goal.status === 'active' ? `<form id="update-form"><textarea name="body" aria-label="${esc(t('Progress update'))}" maxlength="1200" placeholder="${esc(t('What changed? Add an answer, call note, or result.'))}" required></textarea><input name="url" aria-label="${esc(t('Evidence link'))}" type="url" placeholder="${esc(t('Evidence link (optional, https://)'))}"><button class="secondary wide" type="submit">${t('Save update')}</button></form>` : ''}
    <div class="timeline">${goal.updates.length ? goal.updates.map(update => `<article><i></i><div><small>${fmt(update.createdAt)} · ${kinds[update.kind]}</small><p>${esc(update.kind === 'milestone' ? t(update.body) : update.body)}</p>${update.url ? `<a href="${esc(update.url)}" target="_blank" rel="noopener">${t('Open evidence ↗')}</a>` : ''}</div></article>`).join('') : `<p class="muted">${t('Updates and evidence will appear here.')}</p>`}</div>
  </section>`;
}

function render() {
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
  if (loadError) {
    app.innerHTML = `<section class="plan-start error-notice" role="alert"><h1>${t('Your workspace could not be loaded')}</h1><p>${esc(t(loadError))}</p><p>${t('Reconnect before making changes so your saved history stays safe.')}</p><button class="primary" data-action="retry-load">${t('Retry connection')}</button></section>`;
    return;
  }
  app.innerHTML = view === 'new' ? renderNew() : view === 'goal' ? renderGoal(activeGoal()) : renderHome();
  for (const form of app.querySelectorAll('form')) {
    const saved = drafts.get(formKey(form));
    if (saved && form.closest('details')) form.closest('details').open = true;
    if (saved) for (const [name, value] of Object.entries(saved)) {
      const field = form.elements.namedItem(name);
      if (field && field.type !== 'checkbox' && field.type !== 'hidden') field.value = value;
    }
  }
  if (savingMessage || busy) for (const control of app.querySelectorAll('button, input, textarea, select')) control.disabled = true;
  refreshPlaceholderHints();
  if (modal) {
    const card = app.querySelector('.modal-card');
    (card.querySelector('#resolution-input:not([disabled])') || card.querySelector(FOCUSABLE))?.focus();
  }
}

function refreshPlaceholderHints() {
  for (const hint of app.querySelectorAll('[data-hint-for]')) {
    const form = document.getElementById(hint.dataset.hintFor);
    if (!form) continue;
    const missing = missingPlaceholders(Object.fromEntries(new FormData(form)));
    hint.textContent = missing.length ? t('Replace these placeholders: {list}', { list: missing.join(', ') }) : t('Review the facts, links, and tone before sending.');
  }
}

function openModal(name, invoker) {
  modal = name; modalReturn = invoker?.dataset.action || '';
  render();
}

function closeModal() {
  modal = null; render();
  if (modalReturn) app.querySelector(`[data-action="${modalReturn}"]`)?.focus();
  modalReturn = '';
}

async function runReplyModel(goal, reply, task, consent, extraContext = '') {
  if (!consent) { announce('Confirm Anna processing first.', 'error'); return false; }
  if (busy || savingMessage) return false;
  replyError = ''; busy = true;
  busyMessage = task === 'analysis' ? 'Anna is reading the reply…' : 'Anna is preparing your response…';
  render();
  try {
    const result = task === 'analysis' ? await platform.analyzeReply(goal, reply.id, true) : await platform.draftResponse(goal, reply.id, true, extraContext);
    const next = task === 'analysis' ? applyReplyAnalysis(goal, reply.id, result) : saveResponseDraft(goal, reply.id, result);
    await persist(upsertGoal(workspace, next), task === 'analysis' ? 'Reply analysis saved. Review it against the original.' : 'Response draft saved. Review and edit before sending.');
    if (task === 'draft') drafts.delete(`response-form:${goal.id}:${reply.id}`);
    return true;
  } catch (error) { replyError = error.message || 'Please try again.'; return false; }
  finally { busy = false; busyMessage = ''; render(); }
}

async function runNudgeModel(goal, extraContext = '') {
  nudgeError = ''; busy = true; busyMessage = 'Anna is drafting your follow-up…'; render();
  try {
    const result = await platform.draftNudge(goal, true, extraContext);
    const next = applySuggestedTitle(saveNudgeDraft(goal, result), result.title);
    await persist(upsertGoal(workspace, next), 'Follow-up draft ready. Edit it, then copy and send it yourself.');
    drafts.delete(`nudge-form:${goal.id}:`);
    return true;
  } catch (error) { nudgeError = error.message || 'Please try again.'; return false; }
  finally { busy = false; busyMessage = ''; render(); }
}

// Home quick start: save the message (or last contact) first, then a single Anna call returns the reading and a draft.
async function runQuick(data) {
  if (data.consent !== 'on') return announce('Confirm Anna processing first.', 'error');
  const waiting = quickMode === 'waiting';
  const goal = quickStartGoal({ ...data, mode: quickMode, receivedOn: localDay() }, { outcome: t('Respond clearly and move this forward.'), title: t('Follow-up') });
  await persist(upsertGoal(workspace, goal), '', waiting ? 'Saving your details…' : 'Saving the message…');
  drafts.delete(`quick-form:${quickMode}`);
  view = 'goal'; goalTab = 'replies'; selectedReplyId = null; replyError = ''; nudgeError = ''; planError = '';
  window.scrollTo?.(0, 0);
  const saved = activeGoal();
  if (waiting) return runNudgeModel(saved);
  const replyId = saved.replies[0].id;
  busy = true; busyMessage = 'Anna is reading the message and drafting a reply…'; render();
  try {
    const result = await platform.quickReply(saved, replyId, true);
    let next = applyReplyAnalysis(saved, replyId, result.analysis);
    next = applySuggestedTitle(saveResponseDraft(next, replyId, result.draft), result.title);
    await persist(upsertGoal(workspace, next), 'Reply draft ready. Check it against the original, then copy and send it yourself.');
  } catch (error) { replyError = error.message || 'Please try again.'; }
  finally { busy = false; busyMessage = ''; render(); }
}

async function buildPlan(goal, consent = document.querySelector('#ai-consent')?.checked) {
  if (!consent) return announce('Confirm Anna processing first.', 'error');
  if (busy || savingMessage) return;
  planError = ''; proposals.delete(goal.id); busy = true; render();
  try {
    const plan = await platform.createPlan(goal, true);
    const planned = applyPlan(goal, plan);
    if (goal.steps.length) {
      proposals.set(goal.id, planned);
      announce('Review the updated plan before applying it.');
    } else await persist(upsertGoal(workspace, planned), 'Your action plan is ready.');
  } catch (error) { planError = error.message || 'Please try again.'; }
  finally { busy = false; render(); }
}

async function copyFrom(form, label) {
  const data = Object.fromEntries(new FormData(form));
  try { await navigator.clipboard.writeText(`${data.subject ? `${t('Subject:')} ${data.subject}\n\n` : ''}${data.body}`); announce(label); }
  catch { form.elements.body.focus(); form.elements.body.select(); announce('Clipboard is unavailable here. The text is selected; copy it manually.'); }
}

// Message-first goals open on their replies; planned goals open on the plan.
function openGoal(id, tab) {
  const goal = workspace.goals.find(item => item.id === id);
  const messageFirst = goal && !goal.steps.length && (goal.replies.length || goal.outreach.lastContact);
  workspace.activeGoalId = id; view = 'goal'; goalTab = proposals.has(id) ? 'plan' : tab || (messageFirst ? 'replies' : 'plan');
  selectedReplyId = null; replyError = ''; nudgeError = ''; planError = '';
  render();
}

document.addEventListener('keydown', event => {
  if (!modal) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (!busy && !savingMessage) closeModal();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = [...app.querySelectorAll(`.modal-card :is(${FOCUSABLE})`)];
  if (!items.length) { event.preventDefault(); return; }
  const first = items[0]; const last = items.at(-1);
  if (!items.includes(document.activeElement)) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

app.addEventListener('input', event => {
  if (event.target.id === 'resolution-input') resolutionDraft = event.target.value;
  const form = event.target.closest('form');
  if (form) drafts.set(formKey(form), Object.fromEntries(new FormData(form)));
  if (form?.id === 'response-form' || form?.id === 'nudge-form') refreshPlaceholderHints();
});
app.addEventListener('change', event => {
  if (event.target.id === 'goal-switch' && event.target.value && !busy && !savingMessage) openGoal(event.target.value);
  if (event.target.id === 'reply-switch' && !busy && !savingMessage) { selectedReplyId = event.target.value; replyError = ''; render(); }
});

app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (savingMessage || busy) return;
  if (button.dataset.action === 'retry-load') { await start(); return; }
  if (button.dataset.action === 'lang') { setLang(getLang() === 'zh' ? 'en' : 'zh'); render(); app.querySelector('[data-action="lang"]')?.focus(); return; }
  if (button.dataset.action === 'home') { view = 'home'; render(); return; }
  if (button.dataset.action === 'new') { planError = ''; view = 'new'; render(); return; }
  if (button.dataset.quick) { quickMode = button.dataset.quick; render(); app.querySelector(`[data-quick="${quickMode}"]`)?.focus(); return; }
  if (button.dataset.action === 'sample') {
    const field = app.querySelector('#quick-form [name=sourceText]');
    field.value = t(SAMPLE); field.dispatchEvent(new Event('input', { bubbles: true })); field.focus(); field.setSelectionRange(0, 0); field.scrollTop = 0;
    announce('Sample message added. It is fictional; tick the consent box to try it.');
    return;
  }
  if (button.dataset.goal) { openGoal(button.dataset.goal, button.dataset.tab); return; }
  if (button.dataset.action === 'modal-cancel') { closeModal(); return; }
  const goal = activeGoal();
  if (!goal) return;
  const pending = proposals.get(goal.id);
  try {
    if (button.dataset.action === 'open-plan' || button.dataset.action === 'open-replies') {
      if (pending) return announce('Apply or discard the proposed plan before switching workspaces.');
      goalTab = button.dataset.action === 'open-plan' ? 'plan' : 'replies'; render(); return;
    }
    if (button.dataset.source) {
      const source = document.getElementById(`source-${button.dataset.source}`);
      if (source) { source.open = true; source.scrollIntoView({ block: 'center' }); }
      return;
    }
    if (button.dataset.action === 'analyze-reply') {
      await runReplyModel(goal, activeReply(goal), 'analysis', document.querySelector('#analysis-consent')?.checked); return;
    }
    if (button.dataset.action === 'copy-response') return copyFrom(document.querySelector('#response-form'), 'Response copied. Review and send it in your own email app.');
    if (button.dataset.action === 'copy-nudge') return copyFrom(document.querySelector('#nudge-form'), 'Follow-up copied. Review and send it in your own email app.');
    if (button.dataset.action === 'discard-plan') { proposals.delete(goal.id); render(); return; }
    if (button.dataset.action === 'apply-plan' && pending) {
      await persist(upsertGoal(workspace, pending), 'Updated plan applied. Completed actions retained.');
      proposals.delete(goal.id); render(); return;
    }
    if (pending) { announce('Apply or discard the proposed plan before making other changes.'); return; }
    if (button.dataset.step) await persist(upsertGoal(workspace, toggleStep(goal, button.dataset.step)), 'Progress saved.', 'Saving progress…');
    if (button.dataset.action === 'plan') await buildPlan(goal);
    if (button.dataset.action === 'replan') openModal('replan', button);
    if (button.dataset.action === 'resolve') { resolutionDraft = ''; openModal('resolve', button); }
    if (button.dataset.action === 'reopen') await persist(upsertGoal(workspace, reopenGoal(goal)), 'Goal reopened.');
    if (button.dataset.action === 'delete') openModal('delete', button);
    if (button.dataset.action === 'modal-confirm') {
      const action = modal;
      if (action === 'resolve') {
        const resolution = document.querySelector('#resolution-input')?.value;
        if (!resolution?.trim()) return announce('Record the outcome before closing the goal.', 'error');
        try {
          await persist(upsertGoal(workspace, resolveGoal(goal, resolution)), 'Goal closed as resolved.');
          modal = null; modalReturn = ''; resolutionDraft = ''; render();
        } catch (error) { modal = 'resolve'; render(); throw error; }
      }
      if (action === 'replan') {
        if (!document.querySelector('#replan-consent')?.checked) return announce('Confirm Anna processing first.', 'error');
        modal = null; modalReturn = '';
        await buildPlan(goal, true);
      }
      if (action === 'delete') {
        const goals = workspace.goals.filter(item => item.id !== goal.id);
        modal = null; modalReturn = ''; view = 'home'; proposals.delete(goal.id);
        await persist({ ...workspace, goals, activeGoalId: goals[0]?.id || null }, 'Goal deleted.');
      }
    }
  } catch (error) { announce(error.message, 'error'); }
});

app.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || savingMessage) return;
  const form = event.target;
  if (!['goal-form', 'quick-form'].includes(form.id) && proposals.has(activeGoal()?.id)) return announce('Apply or discard the proposed plan before saving new context.');
  const draftKey = formKey(form);
  const data = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'quick-form') { await runQuick(data); return; }
    if (form.id === 'goal-form') {
      const goal = createGoal(data);
      view = 'goal'; goalTab = 'plan'; selectedReplyId = null; replyError = ''; nudgeError = '';
      try { await persist(upsertGoal(workspace, goal), 'Goal created.'); }
      catch (error) { view = 'new'; render(); throw error; }
    }
    if (form.id === 'update-form') {
      const current = activeGoal();
      const message = current.steps.length ? 'Update saved. Rebuild with Anna to refresh the plan.' : 'Update saved. Anna will include it when you build the plan.';
      await persist(upsertGoal(workspace, addUpdate(current, data.body, data.url)), message, 'Saving update…');
    }
    if (form.id === 'reply-form') {
      const current = activeGoal();
      const next = addReply(current, data);
      const added = next.replies.find(reply => !current.replies.some(item => item.id === reply.id));
      const latest = next.replies[0].id === added.id;
      await persist(upsertGoal(workspace, next), latest ? 'Reply saved. You can now analyze it or prepare a response.' : 'Earlier reply saved to the history. Your current reply and check-in are unchanged.', 'Saving reply…');
      selectedReplyId = added.id; replyError = '';
      drafts.delete(`followup-form:${next.id}:`);
    }
    if (form.id === 'followup-form') {
      await persist(upsertGoal(workspace, setFollowUp(activeGoal(), data.stage, data.checkInDate)), 'Follow-up saved. Your home screen is up to date.');
    }
    if (form.id === 'draft-request-form') {
      const success = await runReplyModel(activeGoal(), activeReply(activeGoal()), 'draft', data.consent === 'on', data.extraContext);
      if (!success) return;
    }
    if (form.id === 'nudge-request-form') {
      if (data.consent !== 'on') return announce('Confirm Anna processing first.', 'error');
      const next = setLastContact(activeGoal(), data);
      if (!next.outreach.lastContact) return announce('Describe your last message before drafting a follow-up.', 'error');
      await persist(upsertGoal(workspace, next), '', 'Saving your details…');
      drafts.delete(draftKey);
      if (!await runNudgeModel(activeGoal(), data.extraContext)) return;
    }
    if (form.id === 'response-form') {
      const goal = activeGoal(); const reply = activeReply(goal);
      const fields = { ...data, missingInformation: reply.draft?.missingInformation || [] };
      const sent = event.submitter?.dataset.intent === 'sent';
      const next = sent ? recordResponseSent(goal, reply.id, fields, data.checkInDate, data.sentConfirmed === 'on') : saveResponseDraft(goal, reply.id, fields);
      await persist(upsertGoal(workspace, next), sent ? 'Response recorded as sent. This goal is now waiting for a reply.' : 'Draft saved.');
      if (sent) drafts.delete(`followup-form:${goal.id}:`);
    }
    if (form.id === 'nudge-form') {
      const goal = activeGoal();
      const fields = { ...data, missingInformation: goal.outreach.draft?.missingInformation || [] };
      const sent = event.submitter?.dataset.intent === 'sent';
      const next = sent ? recordNudgeSent(goal, fields, data.checkInDate, data.sentConfirmed === 'on') : saveNudgeDraft(goal, fields);
      await persist(upsertGoal(workspace, next), sent ? 'Follow-up recorded as sent. This goal is now waiting for a reply.' : 'Draft saved.');
      if (sent) drafts.delete(`followup-form:${goal.id}:`);
    }
    drafts.delete(draftKey); render();
  } catch (error) { announce(error.message, 'error'); }
});

async function start() {
  loadError = '';
  app.innerHTML = `<div class="boot"><p>${t('Opening your private workspace…')}</p></div>`;
  try { workspace = await platform.load(); }
  catch (error) { loadError = error.message || 'Anna storage is unavailable.'; }
  render();
  await platform.ready();
}
start();
